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
