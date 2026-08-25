/**
 * Three seasons of real production per player, loaded on demand.
 *
 * The file is ~650 KB — worth having when someone opens a profile, not worth
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

let cache: Record<string, PlayerSeason[]> | null = null;
let inFlight: Promise<Record<string, PlayerSeason[]>> | null = null;

const load = async (): Promise<Record<string, PlayerSeason[]>> => {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = import('@/data/nfl/player-history.json').then((module) => {
      cache = ((module.default ?? module) as { history: Record<string, PlayerSeason[]> }).history;
      return cache;
    });
  }
  return inFlight;
};

/** Seasons for one player, most recent last. Empty for anyone with no tape. */
export const loadPlayerHistory = async (playerId: string): Promise<PlayerSeason[]> => {
  const history = await load();
  return history[playerId] ?? [];
};
