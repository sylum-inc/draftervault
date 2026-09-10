/**
 * Every kick a kicker took last season, lazily.
 *
 * `scripts/build-kicking.mjs` folds nflverse's weekly kicking columns — the
 * distance of every made, missed and blocked attempt, and the extra points —
 * into one small file. It is loaded the first time a kicker's dossier asks for
 * it, the way the defensive units are, so opening the board pays nothing for
 * thirty-two men who price at a dollar.
 */
export interface KickGame {
  week: number;
  made: number[];
  missed: number[];
  blocked: number[];
  patMade: number;
  patAtt: number;
}

export interface KickerSeason {
  name: string;
  team: string;
  games: KickGame[];
  attempts: number;
  made: number;
  long: number;
  patMade: number;
  patAtt: number;
}

export interface KickingFile {
  source: string;
  season: number | null;
  generatedAt: string;
  kickers: Record<string, KickerSeason>;
}

let file: KickingFile | null = null;

export const loadKicking = async (): Promise<KickingFile> => {
  if (file) return file;
  const module = await import('@/data/nfl/kicking.json');
  file = (module.default ?? module) as unknown as KickingFile;
  return file;
};

/** The distance buckets every accuracy figure is read in. */
export const KICK_BUCKETS: ReadonlyArray<{ label: string; from: number; to: number }> = [
  { label: '<30', from: 0, to: 29 },
  { label: '30s', from: 30, to: 39 },
  { label: '40s', from: 40, to: 49 },
  { label: '50s', from: 50, to: 59 },
  { label: '60+', from: 60, to: 99 },
];

const inBucket = (distance: number, bucket: { from: number; to: number }) =>
  distance >= bucket.from && distance <= bucket.to;

/** Makes and attempts per bucket for one kicker. */
export const bucketsFor = (kicker: KickerSeason) =>
  KICK_BUCKETS.map((bucket) => {
    let made = 0;
    let attempts = 0;
    for (const game of kicker.games) {
      for (const d of game.made) if (inBucket(d, bucket)) ((made += 1), (attempts += 1));
      for (const d of game.missed) if (inBucket(d, bucket)) attempts += 1;
      for (const d of game.blocked) if (inBucket(d, bucket)) attempts += 1;
    }
    return { ...bucket, made, attempts };
  });

/**
 * The league's make rate per bucket, over every kicker in the file — the
 * reference each of his buckets is read against. Measured, not chosen.
 */
export const leagueBuckets = (data: KickingFile) => {
  const totals = KICK_BUCKETS.map((bucket) => ({ ...bucket, made: 0, attempts: 0 }));
  for (const kicker of Object.values(data.kickers)) {
    bucketsFor(kicker).forEach((bucket, index) => {
      totals[index].made += bucket.made;
      totals[index].attempts += bucket.attempts;
    });
  }
  return totals.map((bucket) => ({
    ...bucket,
    rate: bucket.attempts > 0 ? bucket.made / bucket.attempts : null,
  }));
};

/**
 * What a game of kicks scored, at the scoring the pool uses for kickers: three
 * for a field goal under forty, four from the forties, five from fifty and
 * beyond, one for an extra point. The same table `kickerPoints` in
 * scripts/nflverse.mjs applies when the pool is built, so the two agree.
 */
export const kickPoints = (game: KickGame): number =>
  game.made.reduce((sum, d) => sum + (d >= 50 ? 5 : d >= 40 ? 4 : 3), 0) + game.patMade;

export interface KickerSummary {
  id: string;
  name: string;
  games: number;
  points: number;
  pointsPerGame: number;
  attemptsPerGame: number;
  accuracy: number | null;
  fiftyPlusMade: number;
  fiftyPlusAttempts: number;
  long: number;
}

/** One row per kicker who held a job — eight games or more — for the strips. */
export const kickerSummaries = (data: KickingFile, minimumGames = 8): KickerSummary[] =>
  Object.entries(data.kickers)
    .filter(([, kicker]) => kicker.games.length >= minimumGames)
    .map(([id, kicker]) => {
      const points = kicker.games.reduce((sum, game) => sum + kickPoints(game), 0);
      const fifty = kicker.games.flatMap((game) => [
        ...game.made.filter((d) => d >= 50).map(() => 'made'),
        ...game.missed.filter((d) => d >= 50).map(() => 'missed'),
        ...game.blocked.filter((d) => d >= 50).map(() => 'blocked'),
      ]);
      return {
        id,
        name: kicker.name,
        games: kicker.games.length,
        points,
        pointsPerGame: points / kicker.games.length,
        attemptsPerGame: kicker.attempts / kicker.games.length,
        accuracy: kicker.attempts > 0 ? kicker.made / kicker.attempts : null,
        fiftyPlusMade: fifty.filter((r) => r === 'made').length,
        fiftyPlusAttempts: fifty.length,
        long: kicker.long,
      };
    });
