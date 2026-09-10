/**
 * Three seasons of real production per player, loaded on demand.
 *
 * The file is ~900 KB — worth having when someone opens a profile, not worth
 * paying for on first paint — so it is imported dynamically and cached after
 * the first request.
 */

export interface PlayerSeason {
  season: number;
  team: string;
  games: number;
  pprPoints: number;
  pointsPerGame: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  carries: number;
  rushingYards: number;
  rushingTds: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  targetShare: number | null;
  airYards: number;
  yardsAfterCatch: number;
  /** Points scored in each game played, in order. */
  weekly: number[];
}

/** One line per season a player has ever played, for the shape of a career. */
export interface CareerSeason {
  season: number;
  team: string;
  games: number;
  pprPoints: number;
  pointsPerGame: number;
  age: number | null;
}

interface HistoryFile {
  history: Record<string, PlayerSeason[]>;
  career: Record<string, CareerSeason[]>;
}

let cache: HistoryFile | null = null;
let inFlight: Promise<HistoryFile> | null = null;

const load = async (): Promise<HistoryFile> => {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = import('@/data/nfl/player-history.json').then((module) => {
      const file = (module.default ?? module) as unknown as HistoryFile;
      cache = { history: file.history ?? {}, career: file.career ?? {} };
      return cache;
    });
  }
  return inFlight;
};

/** Seasons for one player, most recent last. Empty for anyone with no tape. */
export const loadPlayerHistory = async (playerId: string): Promise<PlayerSeason[]> => {
  const file = await load();
  return file.history[playerId] ?? [];
};

/** Every season, not just the three that feed the projection. */
export const loadCareer = async (playerId: string): Promise<CareerSeason[]> => {
  const file = await load();
  return file.career[playerId] ?? [];
};

/**
 * Warm the cache without wanting anything out of it yet.
 *
 * The board wants a season's shape on every card, and sixty asynchronous reads
 * that each resolve on their own would repaint the board sixty times. This is
 * the same bargain `playerResearch` already makes: fetch once in the
 * background, then let callers read synchronously out of the cache and flip a
 * single boolean when it lands, so the board re-renders exactly once with the
 * shapes in.
 */
export const primeHistory = (): Promise<void> => load().then(() => undefined);

/**
 * The most recent season's game-by-game scoring, or null if there is none.
 *
 * Synchronous on purpose, and null until `primeHistory` resolves — a card
 * cannot await, and a promise per card is sixty repaints. Null is also the
 * honest answer for a rookie, which is why the caller draws nothing rather
 * than drawing a flat line: a flat line is a claim about a season that did not
 * happen.
 */
export const weeklyShape = (playerId: string): number[] | null => {
  const seasons = cache?.history[playerId];
  if (!seasons?.length) return null;
  const latest = seasons[seasons.length - 1];
  return latest.weekly?.length >= 3 ? latest.weekly : null;
};

/** Which season `weeklyShape` returned, for labelling it honestly. */
export const weeklySeason = (playerId: string): number | null => {
  const seasons = cache?.history[playerId];
  if (!seasons?.length) return null;
  return seasons[seasons.length - 1].season;
};

/**
 * Every season he has played, or null if the file has none.
 *
 * Synchronous out of the same cache and for the same reason `weeklyShape` is:
 * the card that draws a career arc is one of sixty on a memoised board, and a
 * promise per card is sixty repaints. Null for a rookie, which is the honest
 * answer — an arc through one point is not an arc, and drawing one would state
 * a trajectory nobody has observed.
 */
export const careerShape = (playerId: string): CareerSeason[] | null => {
  const seasons = cache?.career[playerId];
  return seasons && seasons.length > 0 ? seasons : null;
};

/**
 * His most recent season, out of the same cache and for the same reason.
 *
 * `weeklyShape` already reaches into this record for the game log; the scoring
 * mix needs the rest of it — and, more to the point, needs it for *everybody*
 * at a position at once, so that "unusually touchdown-dependent" can be a
 * measured claim about the cohort rather than a constant somebody chose. Sixty
 * synchronous map reads is nothing; sixty promises would be sixty repaints.
 */
export const seasonShape = (playerId: string): PlayerSeason | null => {
  const seasons = cache?.history[playerId];
  return seasons && seasons.length > 0 ? seasons[seasons.length - 1] : null;
};
