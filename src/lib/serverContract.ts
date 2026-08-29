/**
 * What the browser and the server are allowed to say to each other.
 *
 * This file exists for the same reason `valuation.ts` and `researchContract.ts`
 * do: two halves of the app must not be able to disagree. The league lives in
 * one file so the pool builder and the board price identically; the citation
 * rules live in one file so the research script and the panel accept the same
 * findings. The wire lives here so `server/` and `draftServer.ts` cannot drift
 * into two different ideas of what a saved draft is. The server imports this
 * module through Node's type stripping, exactly as the pool builder imports
 * `valuation.ts` — the same functions, not a copy of them.
 *
 * The most important thing stated here is what the server is *not*.
 *
 * **The server is a filing cabinet, not a second engine.** A saved draft is the
 * exact text `exportDraft()` produced, stored as an opaque string with a name
 * and a timestamp beside it. The server never parses it, never counts the
 * picks, never learns the league and never decides whether a bid was legal. It
 * cannot: the rules live in `auctionDraftService`, the prices in
 * `valuation.ts`, and a server that understood either would be a second place
 * they live. Everything that comes back off the wire goes through `importDraft`
 * on the way in, which is the same door a file from a USB stick comes through,
 * and gets validated by the same code.
 *
 * That is also what makes solo mode true rather than aspirational. Nothing the
 * server holds is needed to run a draft; it holds copies. Switch it off and the
 * app is what it was before this file existed.
 */

/**
 * The wire version. Bump it whenever a field changes meaning or goes away.
 *
 * **A client and a server that disagree do not talk.** `contractVerdict` below
 * refuses everything except the health handshake, and the panel says which side
 * is stale. Guessing is the tempting alternative and it is the wrong one: the
 * two halves ship from the same git checkout and are updated together, so a
 * mismatch always means somebody forgot to restart the server after a pull —
 * ten seconds to fix. The cost of guessing is not a broken screen, it is a
 * draft written to disk in a shape the other half misreads, which loses the
 * afternoon the server exists to protect.
 *
 * The health response is the handshake, so its field set is frozen: a client
 * from any version must be able to read `kind` and `contract` out of it in
 * order to find out that it cannot read anything else. Add to it only.
 */
export const SERVER_CONTRACT_VERSION = 1;

/** Everything the server answers lives under here; anything else is the app. */
export const API_PREFIX = '/api';

export const ROUTES = {
  /** The handshake. The only route that never needs a token. */
  health: `${API_PREFIX}/health`,
  drafts: `${API_PREFIX}/drafts`,
  jobs: `${API_PREFIX}/jobs`,
} as const;

/**
 * How long the client waits for the handshake before deciding there is nothing
 * there. Short on purpose: discovery must never be something first paint waits
 * on, and a server on the same laptop answers in single-digit milliseconds.
 */
export const DISCOVERY_TIMEOUT_MS = 2500;

/** How often the client asks a running job how it is getting on. */
export const JOB_POLL_MS = 1500;

/**
 * The most a stored draft may be.
 *
 * A full 192-pick export is about 50 kB. Four megabytes is far past any real
 * draft and still small enough that a runaway or a mistaken paste cannot fill
 * the disk before anybody notices.
 */
export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

/** How many log lines a job keeps in memory for the panel to show. */
export const JOB_LOG_LINES = 500;

// ---------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------

/**
 * Why a request failed, as a code the client can branch on.
 *
 * The message beside it is for a person to read and is never parsed — the same
 * split the draft engine's `BidCheck` makes, and for the same reason: a UI that
 * branches on prose breaks the first time somebody improves the wording.
 */
export type ErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'bad-request'
  | 'contract-mismatch'
  | 'too-large'
  | 'busy'
  | 'unavailable'
  | 'server-error';

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

export const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  'not-found': 404,
  'bad-request': 400,
  'contract-mismatch': 409,
  'too-large': 413,
  busy: 409,
  unavailable: 503,
  'server-error': 500,
};

export const apiError = (code: ErrorCode, message: string): ApiError => ({
  error: { code, message },
});

export const isApiError = (value: unknown): value is ApiError => {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
};

// ---------------------------------------------------------------------------
// the handshake
// ---------------------------------------------------------------------------

/**
 * What a server says about itself, and the only thing an unauthenticated
 * caller can learn from it.
 *
 * Deliberately says nothing about the drafts it holds, whose laptop it is, or
 * what keys it was started with. `research` is a boolean — whether an
 * `OPENROUTER_API_KEY` was present in the environment when the process started
 * — and not the key, not a prefix of the key, not its length. There is no route
 * anywhere in this contract that returns a key, which is a stronger guarantee
 * than a route that promises to redact one.
 */
export interface ServerHealth {
  kind: 'draft-vault-server';
  contract: number;
  /** What the owner called this box, so two tunnels are tellable apart. */
  name: string;
  /** Whether every route but this one needs a bearer token. */
  requiresToken: boolean;
  /** Which batch jobs this server can actually run. */
  jobs: { pool: boolean; research: boolean };
  startedAt: string;
}

export type ContractVerdict =
  /** A Draft Vault server speaking our version. Go ahead. */
  | { ok: true; health: ServerHealth }
  /** Something answered, but it is not a server we can use, and why. */
  | { ok: false; reason: 'not-a-server' | 'contract-mismatch'; message: string };

/**
 * Read a health response, and decide whether to talk to whatever sent it.
 *
 * Both halves call this — the client on the answer it got, the server's own
 * test on the answer it gives — so "compatible" has one definition.
 */
export const contractVerdict = (value: unknown): ContractVerdict => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, reason: 'not-a-server', message: 'That address did not answer with JSON.' };
  }
  const health = value as Partial<ServerHealth>;
  if (health.kind !== 'draft-vault-server' || typeof health.contract !== 'number') {
    return {
      ok: false,
      reason: 'not-a-server',
      message: 'Something answered there, but it is not a Draft Vault server.',
    };
  }
  if (health.contract !== SERVER_CONTRACT_VERSION) {
    const side = health.contract < SERVER_CONTRACT_VERSION ? 'server' : 'app';
    return {
      ok: false,
      reason: 'contract-mismatch',
      message:
        `That server speaks version ${health.contract}; this app speaks ` +
        `${SERVER_CONTRACT_VERSION}. The ${side} is the older half — pull and restart it. ` +
        `Nothing was read or written.`,
    };
  }
  return {
    ok: true,
    health: {
      kind: 'draft-vault-server',
      contract: health.contract,
      name: typeof health.name === 'string' ? health.name : 'draft vault',
      requiresToken: health.requiresToken === true,
      jobs: {
        pool: health.jobs?.pool === true,
        research: health.jobs?.research === true,
      },
      startedAt: typeof health.startedAt === 'string' ? health.startedAt : '',
    },
  };
};

// ---------------------------------------------------------------------------
// saved drafts
// ---------------------------------------------------------------------------

/**
 * One stored copy of a draft.
 *
 * `bytes` rather than a pick count, because the pick count would require the
 * server to read the payload — which is the one thing it does not do. The
 * client knows how many picks came back the moment `importDraft` has replayed
 * them, and that number is the honest one anyway: it is how many replayed, not
 * how many were written.
 */
export interface VersionSummary {
  version: number;
  savedAt: string;
  bytes: number;
  /** Why this version exists: "autosave", "named by hand", whatever was sent. */
  note: string;
  /** The wire version it was written under, so an old file is recognisable. */
  contract: number;
}

export interface DraftSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  versions: number;
  latest: VersionSummary | null;
}

/** A draft with its whole version history, newest first. */
export interface DraftDetail extends DraftSummary {
  history: VersionSummary[];
}

/** One version, with the bytes the client will hand to `importDraft`. */
export interface DraftVersion extends VersionSummary {
  id: string;
  payload: string;
}

export interface DraftListResponse {
  contract: number;
  drafts: DraftSummary[];
}

/** Creating a draft, or adding a version to one. */
export interface SaveDraftRequest {
  /** Required on create; on update, absent means keep the name it has. */
  name?: string;
  /** Exactly what `exportDraft()` returned. Opaque to the server. */
  payload: string;
  note?: string;
}

export interface RenameDraftRequest {
  name: string;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

/** Names are shown in a list and used in nothing else; they only need bounds. */
export const cleanDraftName = (raw: unknown, fallback: string): string => {
  const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  return (text || fallback).slice(0, 120);
};

/**
 * Check a save before it is written, on whichever side is asking.
 *
 * The client calls it to avoid a pointless round trip; the server calls it
 * because a client is not something to trust, even this one. Both get the same
 * answer, which is the point of the function living here.
 */
export const validateSaveDraft = (body: unknown): Validated<Required<SaveDraftRequest>> => {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'A save needs a JSON body.' };
  }
  const { name, payload, note } = body as Partial<SaveDraftRequest>;
  if (typeof payload !== 'string' || !payload.trim()) {
    return { ok: false, message: 'A save needs the draft itself in `payload`.' };
  }
  // Counted in bytes rather than characters: a UTF-16 length says nothing about
  // what will land on the disk once team names carry accents or emoji.
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      message: `That draft is ${Math.round(bytes / 1024)} kB; the limit is ${
        MAX_PAYLOAD_BYTES / 1024
      } kB.`,
    };
  }
  return {
    ok: true,
    value: {
      name: cleanDraftName(name, 'Untitled draft'),
      payload,
      note: cleanDraftName(note, 'saved'),
    },
  };
};

/**
 * Ids the client may put in a URL path.
 *
 * Generated by the server, but checked on the way back in rather than trusted,
 * because an id becomes a directory name — and a directory name built from
 * something a caller sent is how a store turns into arbitrary file access.
 * Lowercase hex and dashes only, which no traversal can be spelled in.
 */
export const isDraftId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]{8,32}$/.test(value);

// ---------------------------------------------------------------------------
// batch jobs
// ---------------------------------------------------------------------------

export type JobKind = 'pool' | 'research';

export type JobState = 'running' | 'done' | 'failed' | 'cancelled';

/**
 * What a caller may ask a job to do.
 *
 * This is a closed set of typed fields, not a list of command-line arguments,
 * and `jobArgs` below is the only place one becomes the other. That is
 * deliberate: the routes that start jobs are behind a token, but a token behind
 * a public tunnel is one leak away from being a stranger's, and the difference
 * between "they can rebuild my player pool" and "they can run anything on my
 * laptop" is exactly this function refusing to pass a string through.
 */
export interface JobOptions {
  /** research: only ask about this many players. */
  limit?: number;
  /** research: only ask about one position. */
  position?: string;
  /** research: ask again about players already researched. */
  refresh?: boolean;
  /** pool: build from the download cache without going to the network. */
  offline?: boolean;
}

export interface StartJobRequest {
  kind: JobKind;
  options?: JobOptions;
}

export interface JobRecord {
  id: string;
  kind: JobKind;
  state: JobState;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  /**
   * Where the job wrote its output.
   *
   * A rebuild never writes over `src/data/nfl` while the app is running. A
   * fresh pool changes every price on the board, and a draft in progress was
   * bid against the old ones — the same reason `restore()` refuses a save
   * stamped with a different league. So the job writes to a staging directory
   * and this says where, and moving it into the tree is a deliberate act
   * somebody takes between drafts, with a rebuild after it.
   */
  outDir: string;
  /** How many log lines have been produced in total, for polling to resume at. */
  lines: number;
}

export interface JobLogResponse {
  contract: number;
  job: JobRecord;
  /** Index of the first line included; the client asks for everything after. */
  from: number;
  lines: string[];
}

export interface JobListResponse {
  contract: number;
  jobs: JobRecord[];
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

export const validateStartJob = (body: unknown): Validated<Required<StartJobRequest>> => {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Starting a job needs a JSON body.' };
  }
  const { kind, options } = body as Partial<StartJobRequest>;
  if (kind !== 'pool' && kind !== 'research') {
    return { ok: false, message: 'A job is either `pool` or `research`.' };
  }
  const raw = (typeof options === 'object' && options !== null ? options : {}) as JobOptions;
  const clean: JobOptions = {};

  if (raw.limit !== undefined) {
    const limit = Number(raw.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 2000) {
      return { ok: false, message: '`limit` is a whole number between 1 and 2000.' };
    }
    clean.limit = limit;
  }
  if (raw.position !== undefined) {
    const position = String(raw.position).toUpperCase();
    if (!POSITIONS.includes(position)) {
      return { ok: false, message: `\`position\` is one of ${POSITIONS.join(', ')}.` };
    }
    clean.position = position;
  }
  if (raw.refresh !== undefined) clean.refresh = raw.refresh === true;
  if (raw.offline !== undefined) clean.offline = raw.offline === true;

  return { ok: true, value: { kind, options: clean } };
};

/**
 * Turn checked options into the flags the existing scripts already understand.
 *
 * The scripts are not reimplemented and not wrapped — `scripts/build-player-pool.mjs`
 * and `scripts/research-players.mjs` are what runs, with the same flags a person
 * would type. This function is the whole surface between an HTTP request and an
 * argv, and it can only ever emit strings it composed itself.
 */
export const jobArgs = (kind: JobKind, options: JobOptions, outDir: string): string[] => {
  if (kind === 'pool') {
    // The builder writes four files, so it takes a directory. `--out` is the
    // flag added to it for this; everything else it already understood.
    const args = ['--out', outDir];
    if (options.offline) args.push('--offline');
    return args;
  }
  // The research script writes one file and already took `--out` as a path.
  const args = ['--out', `${outDir}/research.json`];
  if (options.limit !== undefined) args.push('--limit', String(options.limit));
  if (options.position !== undefined) args.push('--position', options.position);
  // `--all` is the script's own spelling of "ignore how recently we asked".
  if (options.refresh) args.push('--all');
  return args;
};

/** Which script each job runs. Named here so both halves agree on it. */
export const JOB_SCRIPTS: Record<JobKind, string> = {
  pool: 'scripts/build-player-pool.mjs',
  research: 'scripts/research-players.mjs',
};

/**
 * The file a job's staging directory is seeded from before it starts, if any.
 *
 * The research script merges into whatever is already at `--out` and skips
 * anybody asked about recently, which is what makes a run that dies at 400
 * worth 400 players. Pointed at an empty staging directory it would lose that
 * and pay for all 628 again, so the current file is copied in first. The pool
 * builder has no equivalent: it rebuilds from the downloads every time.
 */
export const JOB_SEEDS: Record<JobKind, string | null> = {
  pool: null,
  research: 'src/data/nfl/research.json',
};
