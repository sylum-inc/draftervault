/**
 * What a market snapshot is, shared by the script that writes one and the app
 * that reads it.
 *
 * The fifth module of the shape `valuation.ts`, `researchContract.ts`,
 * `serverContract.ts` and `projection.ts` already have, and it exists for a
 * sharper reason than symmetry. `npm run backtest` measured one specific
 * signal — Fantasy Football Calculator's half-PPR **ADP**, thousands of real
 * drafts — and found it beat this board's own ordering in every held-out
 * season. What then shipped as "Use consensus" was driven by FantasyPros
 * **ECR**, an analyst panel, because that is what the pool happened to carry.
 * Those are different signals and they disagree where it costs most: on the
 * 2026 board, live ADP has Gibbs, Bijan, Nacua, Chase and ECR has Chase,
 * Gibbs, Nacua, Bijan. Substituting one for the other was not measured, and
 * this module is what stops it happening silently again — a snapshot names its
 * source, carries its date, and says how many drafts stand behind it.
 *
 * ADP also solves the problem ECR created by being good. Once a market signal
 * *drives* the board, its staleness is a first-order property rather than
 * housekeeping: the bundled ECR can only be refreshed by rebuilding the entire
 * pool, which downloads nineteen megabytes of play-by-play. ADP arrives from
 * one small endpoint, so `npm run fetch:adp` refreshes the number the board is
 * about to be priced from in seconds, on the morning of the draft.
 *
 * The file is generated and bundled like every other. Nothing is fetched from
 * the browser — an auction moves faster than a request does, and the published
 * artifact's CSP blocks every external host.
 */

/** One player's place in the market, already resolved to a pool id. */
export interface MarketRankEntry {
  /** nflverse gsis id, so the client never matches on a name. */
  gsis: string;
  /** Average draft position. Lower is earlier. */
  adp: number;
  /** How many of the sampled drafts took him at all. */
  timesDrafted?: number;
  /** Earliest and latest he went, which is the market's own disagreement. */
  high?: number;
  low?: number;
  /** Standard deviation of his draft slot. */
  stdev?: number;
}

export interface MarketSnapshot {
  /** Human-readable provenance, e.g. "Fantasy Football Calculator half-PPR". */
  source: string;
  /** Scoring the drafts were run at, so a full-PPR board cannot masquerade. */
  scoring: string;
  /** Teams per draft in the sample. */
  teams: number;
  /** How many real drafts stand behind these numbers. */
  drafts: number;
  /** The window the drafts were taken from, ISO dates. */
  from: string;
  to: string;
  /** When the file was written, ISO. What `marketAge` measures against. */
  fetchedAt: string;
  entries: MarketRankEntry[];
}

/** The contract number, bumped when the shape changes incompatibly. */
export const MARKET_CONTRACT = 1;

/**
 * How stale a snapshot is, in whole days, or null if it cannot be read.
 *
 * Measured from `to` — the last day of the drafts sampled — rather than from
 * `fetchedAt`, because re-downloading an unchanged file does not make the
 * market it describes any newer. That distinction is the whole point: a
 * refresh that quietly reports "fetched today" over week-old drafts is exactly
 * the reassurance this is meant to withhold.
 */
export const marketAge = (
  snapshot: Pick<MarketSnapshot, 'to'> | null,
  now = Date.now()
): number | null => {
  if (!snapshot?.to) return null;
  const taken = Date.parse(`${snapshot.to}T00:00:00Z`);
  if (!Number.isFinite(taken)) return null;
  return Math.max(0, Math.floor((now - taken) / 86_400_000));
};

/**
 * Fresh, ageing or stale.
 *
 * Banded rather than a single alarm, on the same reasoning the export counter
 * and the sheet's loss report already use: a warning that fires on day one
 * means nothing by day thirty. The thresholds are about pre-season ADP
 * specifically, which moves fastest in the fortnight before week one — a
 * training-camp injury can move a player thirty picks in three days, and it is
 * precisely those moves the board is now taking its ordering from.
 */
export type MarketFreshness = 'fresh' | 'ageing' | 'stale' | 'unknown';

export const marketFreshness = (
  snapshot: Pick<MarketSnapshot, 'to'> | null,
  now = Date.now()
): MarketFreshness => {
  const age = marketAge(snapshot, now);
  if (age == null) return 'unknown';
  if (age <= 3) return 'fresh';
  if (age <= 10) return 'ageing';
  return 'stale';
};

/** One line a person can read, naming the source, the sample and the age. */
export const describeMarket = (snapshot: MarketSnapshot | null, now = Date.now()): string => {
  if (!snapshot) return 'No draft-market snapshot bundled.';
  const age = marketAge(snapshot, now);
  const when =
    age == null ? 'undated' : age === 0 ? 'today' : age === 1 ? '1 day old' : `${age} days old`;
  return `${snapshot.source}, ${snapshot.drafts.toLocaleString()} drafts to ${snapshot.to} (${when}).`;
};

/**
 * Refuse a snapshot that is not one, rather than half-reading it.
 *
 * The same rule `validateSaveDraft` and `validateResearch` live by: the file is
 * generated, so anything malformed means the generator changed under the
 * reader, and a board silently priced off half a market is worse than a board
 * priced off none.
 */
export const validateMarket = (value: unknown): MarketSnapshot | null => {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<MarketSnapshot>;
  if (typeof snapshot.source !== 'string' || !snapshot.source) return null;
  if (typeof snapshot.to !== 'string' || !snapshot.to) return null;
  if (!Array.isArray(snapshot.entries)) return null;
  const entries: MarketRankEntry[] = [];
  for (const entry of snapshot.entries) {
    if (!entry || typeof entry !== 'object') continue;
    const { gsis, adp } = entry as MarketRankEntry;
    if (typeof gsis !== 'string' || !gsis) continue;
    if (typeof adp !== 'number' || !Number.isFinite(adp) || adp <= 0) continue;
    entries.push(entry as MarketRankEntry);
  }
  if (!entries.length) return null;
  return {
    source: snapshot.source,
    scoring: typeof snapshot.scoring === 'string' ? snapshot.scoring : 'unknown',
    teams: typeof snapshot.teams === 'number' ? snapshot.teams : 0,
    drafts: typeof snapshot.drafts === 'number' ? snapshot.drafts : 0,
    from: typeof snapshot.from === 'string' ? snapshot.from : '',
    to: snapshot.to,
    fetchedAt: typeof snapshot.fetchedAt === 'string' ? snapshot.fetchedAt : '',
    entries,
  };
};
