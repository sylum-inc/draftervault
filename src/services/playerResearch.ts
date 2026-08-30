/**
 * What the web said about a player, loaded on demand.
 *
 * The file is written by `scripts/research-players.mjs`, which asks a
 * web-searching model about every player in the pool and keeps only what it
 * could cite. Nothing is fetched here at run time: an auction moves faster than
 * a search does, and a key that reached the browser would be a key anyone could
 * read out of the bundle. So this is a static file like every other, and the
 * research is as fresh as the last time the script was run.
 *
 * Two things this deliberately does not do. It does not merge research into
 * `Player`, because a finding has a different standing from a target share and
 * should never end up rendered as one. And it produces no number: the direction
 * is `PAY_UP`, `FADE` or `NEUTRAL`, never a price, so the model cannot put a
 * figure on a card next to figures that were computed.
 */
import type { PlayerResearch, ResearchFile } from '@/lib/researchContract';

export type { Finding, PlayerResearch, Direction, Impact } from '@/lib/researchContract';
export { freshnessDays } from '@/lib/researchContract';

let cache: ResearchFile | null = null;
let inFlight: Promise<ResearchFile> | null = null;

const EMPTY: ResearchFile = { generatedAt: null, model: null, players: {} };

const load = async (): Promise<ResearchFile> => {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = import('@/data/nfl/research.json')
      .then((module) => {
        const file = (module.default ?? module) as unknown as ResearchFile;
        cache = { ...EMPTY, ...file, players: file.players ?? {} };
        return cache;
      })
      .catch(() => {
        // No research has been run yet, or the file failed to parse. The room
        // works without it; every panel that shows research says so instead.
        cache = EMPTY;
        return cache;
      });
  }
  return inFlight;
};

/** Everything researched, keyed by the player id the pool uses. */
export const loadResearch = async (): Promise<ResearchFile> => load();

/** One player's findings, or null if nobody has looked him up. */
export const loadPlayerResearch = async (playerId: string): Promise<PlayerResearch | null> => {
  const file = await load();
  return file.players[playerId] ?? null;
};

/**
 * The directions only, for marking a board of 628 rows without loading the
 * findings into every card. Resolves once and is then read synchronously.
 */
export interface ResearchMark {
  direction: PlayerResearch['direction'];
  headline: string;
  findings: number;
}

let marks: Map<string, ResearchMark> | null = null;

/** Warm the mark index. Safe to call repeatedly; the file loads once. */
export const primeResearch = async (): Promise<Map<string, ResearchMark>> => {
  if (marks) return marks;
  const file = await load();
  marks = new Map(
    Object.entries(file.players)
      // A player with nothing found is not marked. An empty badge on the board
      // reads as "checked and clear", which is a claim of its own.
      .filter(([, record]) => record.findings.length > 0)
      .map(([id, record]) => [
        id,
        {
          direction: record.direction,
          headline: record.headline,
          findings: record.findings.length,
        },
      ])
  );
  return marks;
};

/** The mark for one player, once `primeResearch` has resolved. Null before. */
export const researchMark = (playerId: string): ResearchMark | null => marks?.get(playerId) ?? null;
