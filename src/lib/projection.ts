/**
 * The projection model: what a player is expected to score next season.
 *
 * This is the fourth module of its kind, and it exists for the same reason as
 * the other three. `valuation.ts` stops the pool builder and the board
 * disagreeing about a price; `researchContract.ts` stops the research script
 * and the panel disagreeing about a source; `serverContract.ts` stops the
 * server and the client disagreeing about a saved draft. This stops the pool
 * builder and anything that wants to *measure* the model — a backtest, above
 * all — disagreeing about what the model is.
 *
 * That last one is not hypothetical. Every price in the app is a linear
 * function of these projected points, so "is the model any good" is the only
 * question that decides whether the whole board is worth drafting off. A
 * backtest that reimplemented the arithmetic here would answer that question
 * about a copy, and a copy that scored well would be evidence of nothing. So
 * the model moved out of `scripts/build-player-pool.mjs` and into the client
 * tree, where Node's type stripping lets the builder import the very functions
 * a test can drive. `scripts/backtest-projections.mjs` calls
 * `projectPlayer` — the same function, not a second one.
 *
 * Nothing here reads a file, a network or the DOM. It takes a player's seasons,
 * age and missed games and gives points back, which is what lets it be pointed
 * at a season that has already happened.
 *
 * The model itself, unchanged from where it was born:
 *
 *   points = shrunk_ppg x age_multiplier x expected_games
 *
 * A player's rate of scoring is the recency-weighted average of their points
 * per game, shrunk toward the positional baseline in proportion to how little
 * we have seen of them, then adjusted for age. Volume is expected games,
 * discounted by how much time they have actually missed. Every constant is
 * named and sits in one place so it can be argued with.
 */

/**
 * Recency weights, by how many seasons back the tape is.
 *
 * They were written as a literal `{ 2023: 0.2, 2024: 0.3, 2025: 0.5 }` when the
 * only season anybody projected was 2026. Keyed by lag instead, they say the
 * same thing about any target season — which is precisely what a backtest
 * needs, since it has to project a season the constants were not typed for.
 * Index 0 is the season just finished.
 */
export const RECENCY_WEIGHTS = [0.5, 0.3, 0.2] as const;

/** The seasons of tape that inform a projection, oldest first. */
export const projectionSeasons = (target: number): number[] =>
  RECENCY_WEIGHTS.map((_, lag) => target - RECENCY_WEIGHTS.length + lag);

/** How much a season of tape counts toward a projection of `target`. */
export const seasonWeight = (season: number, target: number): number =>
  RECENCY_WEIGHTS[target - season - 1] ?? 0;

/**
 * Games of prior to blend in. Higher means the position regresses harder toward
 * its baseline. Kicking barely predicts itself from one season to the next, so
 * kickers are shrunk until the spread between them nearly disappears — which is
 * why a real auction prices them all at a dollar.
 */
export const SHRINKAGE_GAMES: Record<string, number> = {
  QB: 8,
  RB: 8,
  WR: 8,
  TE: 8,
  K: 60,
};

/** What a position regresses toward when it is not named above. */
export const DEFAULT_SHRINKAGE_GAMES = 8;

/** Peak window and decline rate per position, from the shape of aging curves. */
export const AGE_CURVE: Record<
  string,
  { peakStart: number; peakEnd: number; declinePerYear: number; risePerYear: number }
> = {
  QB: { peakStart: 26, peakEnd: 34, declinePerYear: 0.02, risePerYear: 0.03 },
  RB: { peakStart: 23, peakEnd: 27, declinePerYear: 0.07, risePerYear: 0.05 },
  WR: { peakStart: 25, peakEnd: 29, declinePerYear: 0.04, risePerYear: 0.05 },
  TE: { peakStart: 26, peakEnd: 30, declinePerYear: 0.04, risePerYear: 0.06 },
  K: { peakStart: 24, peakEnd: 36, declinePerYear: 0.01, risePerYear: 0.01 },
};

export const ageMultiplier = (position: string, age: number | null): number => {
  const curve = AGE_CURVE[position];
  if (!curve || !age) return 1;
  if (age < curve.peakStart) return 1 - (curve.peakStart - age) * curve.risePerYear;
  if (age > curve.peakEnd) return Math.max(0.45, 1 - (age - curve.peakEnd) * curve.declinePerYear);
  return 1;
};

/** A player's age in a given season, from a birth date. Null when unknown. */
export const seasonAge = (birthDate: string | null | undefined, season: number): number | null => {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  return season - born.getFullYear();
};

/** One season of a player's production, as the projection needs it. */
export interface SeasonProduction {
  games: number;
  pprPoints: number;
  receptions: number;
}

/**
 * A position's baseline: what a startable-but-unremarkable player produces.
 *
 * The median of last season's per-game rates, over everyone rostered at the
 * position who played enough of it to be a sample rather than a rumour. Note
 * it is the median and not the mean of everyone who took a snap: the mean is
 * dragged down by the fourth-string tight end who caught one pass, and a
 * baseline that low would shrink nobody toward anything.
 */
export const BASELINE_MIN_GAMES = 6;

export interface BaselineSample extends SeasonProduction {
  position: string;
}

export interface PositionBaselines {
  /** Points per game the median rostered player at the position managed. */
  points: Map<string, number>;
  /** Catches per game, so a league paying less than a point for one can be priced. */
  receptions: Map<string, number>;
}

/**
 * Sorted descending, then indexed at half the length — which for an even count
 * is the lower of the two middle values rather than their average. Written out
 * rather than tidied because changing it changes every shrunk projection in the
 * pool by a fraction, and there is no reason to.
 */
const medianOf = (samples: number[]): number => {
  samples.sort((a, b) => b - a);
  return samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.5))];
};

export const positionBaselines = (samples: Iterable<BaselineSample>): PositionBaselines => {
  const pointSamples = new Map<string, number[]>();
  const receptionSamples = new Map<string, number[]>();
  for (const sample of samples) {
    if (!sample.games || sample.games < BASELINE_MIN_GAMES) continue;
    const points = pointSamples.get(sample.position);
    if (points) points.push(sample.pprPoints / sample.games);
    else pointSamples.set(sample.position, [sample.pprPoints / sample.games]);
    const receptions = receptionSamples.get(sample.position);
    if (receptions) receptions.push(sample.receptions / sample.games);
    else receptionSamples.set(sample.position, [sample.receptions / sample.games]);
  }
  const points = new Map<string, number>();
  for (const [position, values] of pointSamples) points.set(position, medianOf(values));
  const receptions = new Map<string, number>();
  for (const [position, values] of receptionSamples) receptions.set(position, medianOf(values));
  return { points, receptions };
};

/** Where a position's baseline lands when nobody at it cleared the sample bar. */
export const FALLBACK_POINT_BASELINE = 6;

// ---------------------------------------------------------------------------
// rookies: what a player is worth before anyone has seen them play
// ---------------------------------------------------------------------------

/** A drafted player, as the rookie curve needs him. */
export interface DraftPick {
  playerId: string;
  season: number;
  round: number;
  position: string;
}

export interface RookieBaseline {
  median: number;
  n: number;
}

/** Rookie seasons shorter than this are noise rather than a sample. */
export const ROOKIE_MIN_GAMES = 4;

/** The first draft class the curve is built from. Tape older than this is a different sport. */
export const ROOKIE_CURVE_FROM = 2010;

/**
 * The last draft class the curve is built from, projecting `target`.
 *
 * Two back rather than one, which looks like an off-by-one and is not: the
 * constant shipped as 2024 while the builder projected 2026. Keeping it at
 * `target - 2` is what makes the extraction change no number, and it is
 * defensible on its own terms — a class whose rookie year has only just
 * finished is the noisiest single input the curve could take, and it is the
 * class the curve is least likely to be asked about, since those players now
 * have tape and go down the production path instead.
 */
export const rookieCurveThrough = (target: number): number => target - 2;

/**
 * What players drafted in each round have actually produced as rookies.
 *
 * Derived from every drafted skill player in the window rather than guessed,
 * which is the whole reason a rookie gets a number at all. Kickers are left out
 * because their rookie year predicts nothing, and the shrinkage constant
 * already prices that in.
 */
export const rookieBaselines = (
  picks: Iterable<DraftPick>,
  seasonsByPlayer: ReadonlyMap<string, ReadonlyMap<number, SeasonProduction>>,
  window: { from?: number; through: number }
): Map<string, RookieBaseline> => {
  const from = window.from ?? ROOKIE_CURVE_FROM;
  const buckets = new Map<string, number[]>(); // `${position}:${round}` -> points per game
  for (const pick of picks) {
    if (!AGE_CURVE[pick.position] || pick.position === 'K') continue;
    if (pick.season < from || pick.season > window.through) continue;
    const rookieYear = seasonsByPlayer.get(pick.playerId)?.get(pick.season);
    if (!rookieYear || rookieYear.games < ROOKIE_MIN_GAMES) continue;
    const key = `${pick.position}:${Math.min(7, pick.round)}`;
    const samples = buckets.get(key);
    if (samples) samples.push(rookieYear.pprPoints / rookieYear.games);
    else buckets.set(key, [rookieYear.pprPoints / rookieYear.games]);
  }
  const baseline = new Map<string, RookieBaseline>();
  for (const [key, samples] of buckets) {
    samples.sort((a, b) => a - b);
    baseline.set(key, { median: samples[Math.floor(samples.length / 2)], n: samples.length });
  }
  return baseline;
};

/** Where a rookie lands when his round has no bucket: well under a startable player. */
export const UNDRAFTED_BASELINE_SHARE = 0.45;

// ---------------------------------------------------------------------------
// the projection itself
// ---------------------------------------------------------------------------

/**
 * Volume. A season is seventeen games, less the time this player has actually
 * missed — capped at six, because a player who missed more than a third of a
 * season is either coming back or is not in the pool at all, and projecting him
 * for four games states a certainty nobody has.
 */
export const FULL_SEASON_GAMES = 17;
export const MAX_MISSED_DISCOUNT = 6;
export const MIN_EXPECTED_GAMES = 10;

export const expectedGames = (gamesMissed: number): number =>
  Math.max(MIN_EXPECTED_GAMES, FULL_SEASON_GAMES - Math.min(MAX_MISSED_DISCOUNT, gamesMissed));

export interface ProjectionInput {
  position: string;
  /** Age in the season being projected; null when the birth date is unknown. */
  age: number | null;
  /** Every season of production on record, keyed by season. */
  seasons?: ReadonlyMap<number, SeasonProduction> | null;
  /** Games missed to injury in the season just finished. */
  gamesMissed?: number;
  /** Draft round, when there is no tape at all. Null means undrafted. */
  draftRound?: number | null;
}

export interface Projection {
  /** Points per game, shrunk toward the positional baseline. */
  ppg: number;
  /** Points for the season, at full PPR. */
  points: number;
  /** Catches for the season, so another scoring can be priced by subtraction. */
  receptions: number;
  expectedGames: number;
  ageMultiplier: number;
  /** What the number is made of, in words the room can read. */
  basis: string;
  /** Games of tape the projection was drawn from. Zero means the rookie path. */
  games: number;
}

/**
 * Project one player for one season.
 *
 * `target` is the season being projected, so this works exactly as well
 * pointed backwards at a season that has already happened — which is the only
 * way to find out whether any of it is true.
 */
export const projectPlayer = (
  input: ProjectionInput,
  baselines: PositionBaselines,
  rookieCurve: ReadonlyMap<string, RookieBaseline>,
  target: number
): Projection => {
  const baseline = baselines.points.get(input.position) ?? FALLBACK_POINT_BASELINE;
  const recBaseline = baselines.receptions.get(input.position) ?? 0;

  let weighted = 0;
  let weightedReceptions = 0;
  let weight = 0;
  let games = 0;
  for (const season of projectionSeasons(target)) {
    const totals = input.seasons?.get(season);
    if (!totals || !totals.games) continue;
    const w = seasonWeight(season, target) * totals.games;
    weighted += (totals.pprPoints / totals.games) * w;
    weightedReceptions += (totals.receptions / totals.games) * w;
    weight += w;
    games += totals.games;
  }

  let ppg: number;
  let recPpg: number;
  let basis: string;
  if (weight > 0) {
    const observed = weighted / weight;
    const prior = SHRINKAGE_GAMES[input.position] ?? DEFAULT_SHRINKAGE_GAMES;
    ppg = (games * observed + prior * baseline) / (games + prior);
    // Receptions run through the identical pipeline. They have to: the client
    // prices a non-PPR league by subtracting them from the points, and a
    // shrunk points figure minus an unshrunk reception figure is neither.
    recPpg = (games * (weightedReceptions / weight) + prior * recBaseline) / (games + prior);
    basis = 'production';
  } else {
    // No tape: fall back to what players drafted in this slot have produced.
    const round = input.draftRound ?? null;
    const key = `${input.position}:${Math.min(7, round || 7)}`;
    ppg = rookieCurve.get(key)?.median ?? baseline * UNDRAFTED_BASELINE_SHARE;
    // No tape means no reception history either. Assume they catch in
    // proportion to how much they are expected to score relative to a typical
    // player at the position — coarse, and it only ever moves cheap players.
    recPpg = baseline > 0 ? recBaseline * (ppg / baseline) : 0;
    basis = round === null ? 'undrafted baseline' : `draft round ${round}`;
  }

  const multiplier = ageMultiplier(input.position, input.age);
  const played = expectedGames(input.gamesMissed ?? 0);

  return {
    ppg,
    points: ppg * multiplier * played,
    // Carried so the client can re-price for a league that pays less than a
    // point per catch, the same way it re-prices for a different league shape.
    receptions: recPpg * multiplier * played,
    expectedGames: played,
    ageMultiplier: multiplier,
    basis,
    games,
  };
};

/**
 * Team defense, pulled most of the way to the league average before it is priced.
 *
 * A separate model because it is a separate thing: a defense has no age, no
 * games missed and no per-game rate worth shrinking — what it has is one
 * season of scoring that barely predicts the next. So the whole model is the
 * regression, and it is heavy on purpose. This is why every defense prices out
 * at a dollar or two, which is what a real auction pays for one.
 */
export const DEFENSE_OWN_WEIGHT = 0.35;

export const regressedDefensePoints = (points: number, leagueMean: number): number =>
  points * DEFENSE_OWN_WEIGHT + leagueMean * (1 - DEFENSE_OWN_WEIGHT);
