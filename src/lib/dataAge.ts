import {
  marketAge,
  marketFreshness,
  type MarketFreshness,
  type MarketSnapshot,
} from './marketContract';

/**
 * How old everything the board knows is, said once.
 *
 * The app is a bundled file. On the night it fetches nothing — that is the
 * whole reason it works in the published artifact and the whole reason it works
 * when the wifi in somebody's basement does not. The cost of that is a board
 * whose knowledge stopped at a moment nobody was shown, and the honest
 * mitigation is not to pretend otherwise: say what it knows and when it learned
 * it, so a "questionable" tag from three weeks ago can be read as three weeks
 * old rather than as news.
 *
 * The market's age was already computed and already banded, and it was visible
 * in exactly one place: inside the rankings modal, which is a setup screen
 * somebody opens once. Everything else had a `generatedAt` in its file and
 * nowhere on screen at all.
 *
 * **What ages and what does not is the part worth stating**, because a single
 * "your data is N days old" would be false about half of it. Projections are
 * built from seasons that have finished; they do not decay, and a pool built a
 * month ago projects exactly what it projected. What decays inside that same
 * file is the roster and injury snapshot around them — who is on which team,
 * and who is hurt. So each source says what it is for, and only the market
 * carries a band, because the market is the only one anybody has measured a
 * decay rate for: pre-season ADP moves fastest in the fortnight before week
 * one, which is precisely when it is being drafted off.
 */
export type Freshness = MarketFreshness;

export interface SourceAge {
  key: 'market' | 'research' | 'pool' | 'identity';
  /** What it is, in the words the room would use. */
  label: string;
  /** What goes out of date about it, or what does not. */
  what: string;
  /** Days since it last learned anything. Null when it never said. */
  days: number | null;
  /**
   * Banded only where a band means something. Everything but the market is
   * `unknown`, which the panel renders as a plain number rather than a colour —
   * inventing a threshold nobody measured would spend the market's credibility
   * on a guess.
   */
  freshness: Freshness;
}

const daysSince = (stamp: string | null | undefined, now: number): number | null => {
  if (!stamp) return null;
  const at = Date.parse(stamp);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
};

export interface DataStamps {
  market: Pick<MarketSnapshot, 'to'> | null;
  /** When the research file was last written. */
  research: string | null;
  /** When the pool was last built. */
  pool: string | null;
  /** When team colours, crests and rosters were last snapshotted. */
  identity: string | null;
}

export const dataAges = (stamps: DataStamps, now = Date.now()): SourceAge[] => [
  {
    key: 'market',
    label: 'Draft market',
    what: 'what real drafts were taking — this is what orders the board',
    days: marketAge(stamps.market, now),
    freshness: marketFreshness(stamps.market, now),
  },
  {
    key: 'research',
    label: 'Research',
    what: 'holdouts, injuries, coaching changes — the register that goes off fastest',
    days: daysSince(stamps.research, now),
    freshness: 'unknown',
  },
  {
    key: 'pool',
    label: 'Rosters and injuries',
    what: 'who is on which team, and who is hurt',
    days: daysSince(stamps.pool, now),
    freshness: 'unknown',
  },
  {
    key: 'identity',
    label: 'Teams',
    what: 'colours, crests and faces',
    days: daysSince(stamps.identity, now),
    freshness: 'unknown',
  },
];

/**
 * The one line to lead with, or null when there is nothing to say.
 *
 * Only the market can be loud, for the reason above. `refresh` names the script
 * because knowing something is stale without knowing what to run about it is
 * the half of a warning that costs attention and buys nothing — and this one
 * takes seconds, unlike the rebuild behind everything else.
 */
export const stalest = (ages: SourceAge[]): { text: string; refresh: string } | null => {
  const market = ages.find((source) => source.key === 'market');
  if (!market || market.days == null) return null;
  if (market.freshness === 'fresh') return null;
  return {
    text:
      `The draft market is ${market.days} days old, and it is what orders this board. ` +
      'Pre-season ADP moves fastest in the fortnight before week one.',
    refresh: 'npm run fetch:adp',
  };
};

/**
 * What never goes out of date, said once so the panel above can be read
 * correctly. Projections come from seasons that have finished.
 */
export const PROJECTIONS_DO_NOT_AGE =
  'Projections are built from seasons that have already finished, so they do not go out of date — what ages in the same file is the roster and injury snapshot around them.';
