import type { ScheduleGame } from '@/components/draft-room/charts/ScheduleStrip';

/**
 * The 2026 regular season, by team, loaded on demand.
 *
 * Difficulty on each game is the opponent's points allowed per game last
 * season, ranked across the league — see scripts/build-player-pool.mjs.
 */
let cache: Record<string, ScheduleGame[]> | null = null;
let inFlight: Promise<Record<string, ScheduleGame[]>> | null = null;

export const loadSchedule = async (team: string): Promise<ScheduleGame[]> => {
  if (!cache) {
    inFlight ??= import('@/data/nfl/schedule.json').then((module) => {
      cache = ((module.default ?? module) as { teams: Record<string, ScheduleGame[]> }).teams;
      return cache;
    });
    await inFlight;
  }
  return cache?.[team] ?? [];
};

/**
 * Warm the whole file, once.
 *
 * The card that draws the season ahead is one of sixty on a memoised board and
 * cannot await, so this is the bargain `primeHistory` and `primeResearch`
 * already make: fetch once in the background, read synchronously afterwards,
 * and flip a single boolean when it lands so the board repaints exactly once.
 * There is one file for all thirty-two clubs, so priming it costs the same
 * request opening one profile already cost.
 */
export const primeSchedule = async (): Promise<void> => {
  await loadSchedule('KC');
};

/** One club's season, once `primeSchedule` has resolved. Null before it has. */
export const teamSchedule = (team: string): ScheduleGame[] | null => cache?.[team] ?? null;
