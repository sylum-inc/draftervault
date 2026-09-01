/**
 * What a normal player at each position actually does.
 *
 * Every instrument on the board needs a scale, and the scale cannot come from
 * the board: it is sixty players off a commissioner's sheet, every one of them
 * in the top decile of his position, so anything normalised against *them*
 * reads full for all sixty. An instrument that gives the same answer for the
 * best sixty players is decoration. The scale has to come from the position.
 *
 * Two marks per metric per position:
 *
 *   `median` — where the middle of the position sits, drawn as a crosshair or a
 *   notch. "Above the median" is then a claim about the job rather than about
 *   the sixty men the commissioner happened to list.
 *
 *   `top` — the ninetieth percentile, which is full deflection. Not the maximum:
 *   one outlier with a hundred and twenty red-zone touches would compress every
 *   other back into the first third of the glyph, and a scale set by its own
 *   worst case is a scale nobody can read. A reading past it pins, which is
 *   itself a reading.
 *
 * Built once from the engine's *live* players rather than from pool.json, and
 * that is not a detail: `snapPercentage` and `pointsPerGame` are derived when a
 * player is built and are null in the file. Reading the file gave an empty
 * bucket for every snap-share norm, `positionNorm` returned null for all of
 * them, and the role field silently rendered nothing at all on every card —
 * the failure mode of a lookup that answers "I don't know" the same way it
 * answers "there is nothing there".
 *
 * Read synchronously afterwards, for the reason the identity and research
 * lookups are: a card cannot await, and a prop would be a new reference on
 * every render and would defeat the board's memo.
 */
export type NormMetric = 'snap' | 'carry' | 'target' | 'redZone' | 'ppg';

export interface Norm {
  /** The middle of the position. The notch on the dial. */
  median: number;
  /** Full deflection: the ninetieth percentile, not the maximum. */
  top: number;
}

/** Just enough of a player for this; the engine's `Player` satisfies it. */
export interface NormSubject {
  position: string;
  /** Used only to pick the cohort: the men who actually start. */
  projectedPoints: number;
  snapPercentage?: number | null;
  pointsPerGame?: number | null;
  usage?: {
    carryShare?: number | null;
    targetShare?: number | null;
    redZoneTouches?: number | null;
  } | null;
}

const METRICS: readonly NormMetric[] = ['snap', 'carry', 'target', 'redZone', 'ppg'];

const readingOf = (player: NormSubject, metric: NormMetric): number | null => {
  switch (metric) {
    case 'snap':
      return player.snapPercentage ?? null;
    case 'ppg':
      return player.pointsPerGame ?? null;
    case 'carry':
      return player.usage?.carryShare ?? null;
    case 'target':
      return player.usage?.targetShare ?? null;
    case 'redZone':
      return player.usage?.redZoneTouches ?? null;
  }
};

const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
};

const build = (
  players: readonly NormSubject[],
  rostered: Record<string, number>
): Map<string, Norm> => {
  /*
   * The cohort is the men who start, not everybody in the pool.
   *
   * This was got wrong first and it made both instruments useless in the same
   * way. Six hundred and twenty-eight players is mostly depth: the median
   * running back in that set is on the field for 31% of snaps and scores 4.3
   * points a game, so every one of the sixty on a commissioner's sheet sat in
   * the same corner of the role field and every column of every game log pinned
   * at the top of its scale — Jahmyr Gibbs *averages* 16.6 points a game
   * against a ninetieth percentile of 9.7.
   *
   * A drafter never compares a player to the four hundredth back. He compares
   * him to the backs who start, which is what the league rosters. So the
   * distribution is taken over that many, by projection, and the crosshair
   * becomes the median starter — a bar worth clearing.
   */
  const cohort = new Map<string, NormSubject[]>();
  for (const player of players) {
    const bucket = cohort.get(player.position);
    if (bucket) bucket.push(player);
    else cohort.set(player.position, [player]);
  }
  const starters: NormSubject[] = [];
  for (const [position, group] of cohort) {
    group.sort((a, b) => b.projectedPoints - a.projectedPoints);
    starters.push(...group.slice(0, Math.max(6, rostered[position] ?? group.length)));
  }

  const buckets = new Map<string, number[]>();
  for (const player of starters) {
    for (const metric of METRICS) {
      const reading = readingOf(player, metric);
      // Zero is a real reading for a receiver's carry share and a meaningless
      // one for a player who was simply never measured, and the pool cannot
      // tell them apart. Dropping nulls only is the honest line: it keeps a
      // genuine zero in the distribution and leaves absent data out of it.
      if (reading == null || !Number.isFinite(reading)) continue;
      const key = `${player.position}:${metric}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(reading);
      else buckets.set(key, [reading]);
    }
  }

  const norms = new Map<string, Norm>();
  for (const [key, values] of buckets) {
    // Six is the fewest that makes a median mean anything; below it the notch
    // would be an accident of who happened to be measured.
    if (values.length < 6) continue;
    values.sort((a, b) => a - b);
    const top = quantile(values, 0.9);
    norms.set(key, {
      median: quantile(values, 0.5),
      // A degenerate distribution — every player identical — would give a scale
      // of zero and a division by it.
      top: top > 0 ? top : Math.max(...values, 1),
    });
  }
  return norms;
};

let cache: Map<string, Norm> | null = null;

/**
 * Fill the cache from the built board, once.
 *
 * Called when the engine finishes building its players. Guarded rather than
 * recomputed, because a reprice rebuilds every player and none of these
 * readings is a function of the league or of a price — the usage happened last
 * season and does not move when the budget does.
 */
let signature = '';

export const primeNorms = (
  players: readonly NormSubject[],
  rostered: Record<string, number>
): void => {
  if (!players.length) return;
  // Rebuilt when the cohort itself moves — a league with more teams rosters
  // more players and the median starter is a different man. Not when a price
  // moves, which is most repricings and none of this data.
  const next = `${players.length}:${JSON.stringify(rostered)}`;
  if (cache && signature === next) return;
  signature = next;
  cache = build(players, rostered);
};

export const positionNorm = (position: string, metric: NormMetric): Norm | null =>
  cache?.get(`${position}:${metric}`) ?? null;
