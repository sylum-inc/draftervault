/**
 * The rules a researched finding has to pass to be shown at all.
 *
 * This file exists for the same reason `valuation.ts` does: the batch script
 * and the browser must not be able to disagree. The script enforces the
 * contract when it writes `research.json`; the app states the contract in the
 * panel that renders it; the tests here are the only place either is defined.
 * Node strips the types on import, so `scripts/research-players.mjs` gets the
 * identical functions rather than a copy that drifts.
 *
 * The contract is deliberately narrow, because the thing being guarded against
 * is specific. A language model asked for sourced findings will produce
 * something shaped exactly like a sourced finding whether or not it found one,
 * and a plausible URL is the cheapest part of that to fabricate. So the model's
 * URL is never trusted: the search engine's own citation list is the allowlist,
 * and a claim that cannot point at an entry on it is dropped. What survives is
 * not "the model says so" but "this page says so, and here it is".
 */

/** Which way a finding argues against the model's own number. */
export type Impact = 'POSITIVE' | 'NEGATIVE' | 'CONTEXT';

/** What the research says to do about the price, never what the price is. */
export type Direction = 'PAY_UP' | 'FADE' | 'NEUTRAL';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Finding {
  claim: string;
  /** The URL as the search engine returned it, not as the model retyped it. */
  url: string;
  /** Host only, for showing who said it without showing the whole URL. */
  source: string;
  /** When the cited page was published, YYYY-MM-DD. */
  published: string;
  impact: Impact;
}

/** How much was thrown away, so the panel can admit it rather than hide it. */
export interface Dropped {
  unsourced: number;
  undated: number;
  malformed: number;
}

export interface Research {
  direction: Direction;
  confidence: Confidence;
  /** One clause. Empty when nothing survived, which is not a failure. */
  headline: string;
  findings: Finding[];
  dropped: Dropped;
}

export interface PlayerResearch extends Research {
  name: string;
  position: string;
  team: string;
  /** When we asked, not when the sources were published. */
  researchedAt: string;
}

export interface ResearchFile {
  generatedAt: string | null;
  model: string | null;
  engine?: string;
  contract?: string;
  players: Record<string, PlayerResearch>;
}

/**
 * Nothing published before this is news; it is history the pool already has,
 * measured rather than reported.
 */
export const OLDEST_USEFUL = '2025-01-01';

const DIRECTIONS = new Set<string>(['PAY_UP', 'FADE', 'NEUTRAL']);
const CONFIDENCES = new Set<string>(['HIGH', 'MEDIUM', 'LOW']);
const IMPACTS = new Set<string>(['POSITIVE', 'NEGATIVE', 'CONTEXT']);

/**
 * A URL reduced to the part worth comparing: host without `www.`, path without
 * a trailing slash, no scheme, no query, no fragment.
 *
 * Query strings are dropped on purpose. Models routinely echo a URL back with
 * a tracking parameter shaved off or a `?utm_source` added, and rejecting that
 * citation would be pedantry rather than a caught fabrication — the page is
 * the same page. Host and path are what identify the claim's source, and those
 * have to match exactly.
 */
export const canonicalUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
};

interface Annotated {
  annotations?: unknown;
}

/**
 * The allowlist, built from what the search engine actually returned.
 *
 * Maps the canonical shape back to the full URL so that what gets stored is
 * the engine's URL rather than the model's rendering of it.
 */
export const citedUrls = (message: Annotated | null | undefined): Map<string, string> => {
  const allowed = new Map<string, string>();
  const notes = Array.isArray(message?.annotations) ? message.annotations : [];
  for (const note of notes) {
    const record = note as { url_citation?: { url?: unknown }; url?: unknown };
    const raw = record?.url_citation?.url ?? record?.url;
    const shape = canonicalUrl(raw);
    if (shape && typeof raw === 'string') allowed.set(shape, raw);
  }
  return allowed;
};

/**
 * Pull the JSON object out of a reply, tolerating a code fence or a sentence
 * of preamble around it. Returns null rather than throwing, so one chatty
 * response costs one player rather than the run.
 */
export const parseReply = (text: unknown): unknown => {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
};

const isoToday = (): string => new Date().toISOString().slice(0, 10);

/**
 * Apply the contract to one reply.
 *
 * `allowed` is the citation list from the same response — a finding is kept
 * only if its URL is on it and it carries a usable publication date.
 */
export const validateResearch = (
  answer: unknown,
  allowed: Map<string, string>,
  now: string = isoToday()
): Research => {
  const reply = (answer ?? {}) as {
    direction?: unknown;
    confidence?: unknown;
    headline?: unknown;
    findings?: unknown;
  };
  const dropped: Dropped = { unsourced: 0, undated: 0, malformed: 0 };
  const findings: Finding[] = [];
  const seen = new Set<string>();

  const raws = Array.isArray(reply.findings) ? reply.findings : [];
  for (const entry of raws) {
    const raw = (entry ?? {}) as {
      claim?: unknown;
      url?: unknown;
      published?: unknown;
      impact?: unknown;
    };
    const claim = typeof raw.claim === 'string' ? raw.claim.trim() : '';
    if (claim === '') {
      dropped.malformed += 1;
      continue;
    }

    const shape = canonicalUrl(raw.url);
    const url = shape === null ? undefined : allowed.get(shape);
    if (url === undefined) {
      dropped.unsourced += 1;
      continue;
    }

    const published = typeof raw.published === 'string' ? raw.published.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(published) || published > now || published < OLDEST_USEFUL) {
      dropped.undated += 1;
      continue;
    }

    // Two findings citing the same page are one finding said twice.
    const fingerprint = `${shape}|${claim.toLowerCase()}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    findings.push({
      claim,
      url,
      source: new URL(url).hostname.replace(/^www\./, ''),
      published,
      impact: IMPACTS.has(raw.impact as string) ? (raw.impact as Impact) : 'CONTEXT',
    });
  }

  findings.sort((a, b) => b.published.localeCompare(a.published));

  let direction: Direction = DIRECTIONS.has(reply.direction as string)
    ? (reply.direction as Direction)
    : 'NEUTRAL';
  let confidence: Confidence = CONFIDENCES.has(reply.confidence as string)
    ? (reply.confidence as Confidence)
    : 'LOW';
  let headline = typeof reply.headline === 'string' ? reply.headline.trim().slice(0, 160) : '';

  // A headline is a summary, so a figure in one can only be a valuation
  // wearing a fact's clothes. A claim may quote a contract; a headline may not.
  if (/\$\s?\d/.test(headline)) headline = '';

  if (findings.length === 0) {
    // No surviving evidence, no opinion. This is the branch that stops a
    // fabricated take from outliving the citation that was meant to carry it:
    // strip the sources and the position goes with them.
    direction = 'NEUTRAL';
    confidence = 'LOW';
    headline = '';
  } else if (!findings.some((finding) => finding.impact !== 'CONTEXT')) {
    // Everything that survived was background, and background does not argue
    // for a move in either direction.
    direction = 'NEUTRAL';
  }

  return { direction, confidence, headline, findings, dropped };
};

/** How stale the newest source is, in days. Null when there are no findings. */
export const freshnessDays = (research: Research, now: Date = new Date()): number | null => {
  const newest = research.findings[0]?.published;
  if (!newest) return null;
  const then = Date.parse(`${newest}T00:00:00Z`);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
};
