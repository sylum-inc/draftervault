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
