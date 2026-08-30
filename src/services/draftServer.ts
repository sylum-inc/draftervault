/**
 * Talking to the optional server, and being silent when there is not one.
 *
 * **The default state of this module is doing nothing at all.** No server is
 * configured until somebody configures one, and with none configured every
 * call here returns `no-server` without touching `fetch`. That is not a
 * fallback path, it is the ordinary one: the app shipped without a backend, the
 * published artifact has no host it is allowed to reach, and draft night will
 * be run with this switched off if anything at all goes wrong.
 *
 * That is also why discovery is opt-in rather than a probe. The obvious design
 * — ask the current origin whether it happens to be a Draft Vault server —
 * costs a failed request on every single load of an app whose normal condition
 * is having no server, and a browser prints that failure to the console whether
 * it was speculative or not. A red line under a board somebody is drafting off
 * is a reason to distrust the board. So the address has to come from somewhere
 * deliberate, and there are exactly three:
 *
 *   1. what the owner typed into the server panel (localStorage),
 *   2. a `<meta name="draft-vault-server">` the server itself injected into the
 *      page it served — which is how the tunnelled case needs no typing at all,
 *   3. `VITE_DRAFT_SERVER` at build time, for a dev server on another port.
 *
 * None of those exist in the single-file build or the published artifact, so
 * both are provably inert: not "handles the error", but never makes the call.
 *
 * Nothing secret is ever in any of them. The address is an address; the token
 * is a shared token the owner pastes in, held in his own browser, and it is
 * never a `VITE_*` value — those are compiled into the bundle and readable by
 * anyone who opens it.
 */
import {
  API_PREFIX,
  DISCOVERY_TIMEOUT_MS,
  SERVER_CONTRACT_VERSION,
  contractVerdict,
  isApiError,
  validateSaveDraft,
  type DraftDetail,
  type DraftSummary,
  type DraftVersion,
  type ErrorCode,
  type JobKind,
  type JobLogResponse,
  type JobOptions,
  type JobRecord,
  type ServerHealth,
} from '@/lib/serverContract';

/** Where the server is, and what it wants, as the owner set it. */
export interface ServerConfig {
  /** Base URL of the API, e.g. `/api` or `http://127.0.0.1:8788/api`. */
  url: string;
  /** The shared token, or empty when the server does not want one. */
  token: string;
}

const CONFIG_KEY = 'draft-vault:server:v1';
/** Which stored draft the autosave is adding versions to. */
const BINDING_KEY = 'draft-vault:server-draft:v1';

export interface ServerBinding {
  id: string;
  name: string;
}

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Private mode, a cleared profile, a quota. None of it is worth a word:
    // the answer is the same as never having configured a server.
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the setting simply will not survive a reload */
  }
};

/** The address the page was served with, if the server put one there. */
const metaAddress = (): string | null => {
  try {
    const meta = document.querySelector('meta[name="draft-vault-server"]');
    const content = meta?.getAttribute('content')?.trim();
    return content || null;
  } catch {
    return null;
  }
};

/** A build-time default, for `npm run dev` on one port and the server on another. */
const buildAddress = (): string | null => {
  try {
    const value = (import.meta.env?.VITE_DRAFT_SERVER as string | undefined)?.trim();
    return value || null;
  } catch {
    return null;
  }
};

/** Trim a trailing slash so joining a path cannot produce a double one. */
const tidy = (url: string): string => url.trim().replace(/\/+$/, '');

/**
 * Where to talk to, in order of how deliberate the instruction was.
 *
 * What the owner typed wins over what the page was served with, because the one
 * time the two differ is when he is deliberately pointing a dev build at a
 * server somewhere else, and the whole reason to have the field is to be able
 * to do that.
 */
export const serverConfig = (): ServerConfig | null => {
  const stored = readJson<Partial<ServerConfig>>(CONFIG_KEY);
  // Off is a state, not the absence of one. Storing null meant Disconnect only
  // deleted an override, and discovery immediately found the same address again
  // through the meta tag the server injects into the page it serves — which is
  // the normal way to use this. The panel then said "Disconnected" beside a live
  // connection. Somebody turning the room off at 11pm has to be able to.
  if (stored && stored.url === '') return null;
  if (stored && typeof stored.url === 'string' && stored.url.trim()) {
    return { url: tidy(stored.url), token: typeof stored.token === 'string' ? stored.token : '' };
  }
  const address = metaAddress() ?? buildAddress();
  return address ? { url: tidy(address), token: '' } : null;
};

export const setServerConfig = (config: ServerConfig | null): void => {
  writeJson(CONFIG_KEY, config ? { url: tidy(config.url), token: config.token } : null);
};

/** True when there is an address to try. Never performs any I/O. */
export const isConfigured = (): boolean => serverConfig() !== null;

/** Whether the address came from the page rather than from something typed. */
export const isServedAddress = (): boolean => readJson(CONFIG_KEY) === null && !!metaAddress();

export const serverBinding = (): ServerBinding | null => {
  const stored = readJson<Partial<ServerBinding>>(BINDING_KEY);
  return stored && typeof stored.id === 'string'
    ? { id: stored.id, name: typeof stored.name === 'string' ? stored.name : 'Draft' }
    : null;
};

export const setServerBinding = (binding: ServerBinding | null): void => {
  writeJson(BINDING_KEY, binding);
};

// ---------------------------------------------------------------------------
// calling it
// ---------------------------------------------------------------------------

/**
 * Every reason a call did not produce an answer, including the two that are
 * not the server's fault.
 *
 * `no-server` is not an error and must never be rendered as one: it is the
 * app's ordinary condition. `offline` means an address was configured and
 * nothing answered — worth telling the owner about in the panel, and worth
 * telling nobody about anywhere else.
 */
export type FailureCode = ErrorCode | 'no-server' | 'offline';

export type ServerResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: FailureCode; message: string };

const noServer = <T>(): ServerResult<T> => ({
  ok: false,
  code: 'no-server',
  message: 'No server is configured. Everything here works without one.',
});

/** `AbortSignal.timeout` where it exists; older engines just wait. */
const timeoutSignal = (ms: number): AbortSignal | undefined => {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
};

interface CallOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  /** Override the stored config — used by the panel to test an address first. */
  config?: ServerConfig;
}

const call = async <T>(path: string, options: CallOptions = {}): Promise<ServerResult<T>> => {
  const config = options.config ?? serverConfig();
  if (!config) return noServer<T>();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Sent on everything so a stale half is caught at the first request rather
    // than after it has written something the other half cannot read.
    'X-Draft-Vault-Contract': String(SERVER_CONTRACT_VERSION),
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: timeoutSignal(options.timeoutMs ?? DISCOVERY_TIMEOUT_MS * 4),
      // No cookies, in either direction. Authentication is a header a caller
      // attaches on purpose, which is what makes another tab's page unable to
      // act as the owner even if it knows the address.
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    // A tunnel that dropped, a laptop that slept, a server that was stopped.
    // The draft is unaffected — it is in localStorage, where it always was.
    return {
      ok: false,
      code: 'offline',
      message: 'The server did not answer. The draft is safe in this browser regardless.',
    };
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    if (isApiError(parsed)) {
      return { ok: false, code: parsed.error.code, message: parsed.error.message };
    }
    return {
      ok: false,
      code: 'server-error',
      message: `The server answered ${response.status} and said nothing useful about why.`,
    };
  }

  return { ok: true, value: parsed as T };
};

// ---------------------------------------------------------------------------
// the handshake
// ---------------------------------------------------------------------------

export type Discovery =
  | { state: 'off' }
  | { state: 'ready'; health: ServerHealth; config: ServerConfig }
  | { state: 'unreachable'; message: string; config: ServerConfig }
  | { state: 'incompatible'; message: string; config: ServerConfig };

/**
 * Find out whether the configured address is a server we can use.
 *
 * Short timeout, because nothing is allowed to wait on this: a server on the
 * same laptop answers in a millisecond or two, and the honest answer for
 * anything slower is that draft night should not depend on it. The result is
 * a state rather than a throw, so a caller has nothing to catch.
 */
export const describeServer = async (override?: ServerConfig): Promise<Discovery> => {
  const config = override ?? serverConfig();
  if (!config) return { state: 'off' };

  const result = await call<unknown>('/health', {
    timeoutMs: DISCOVERY_TIMEOUT_MS,
    config,
  });
  if (!result.ok) {
    return { state: 'unreachable', message: result.message, config };
  }
  const verdict = contractVerdict(result.value);
  if (!verdict.ok) {
    return { state: 'incompatible', message: verdict.message, config };
  }
  return { state: 'ready', health: verdict.health, config };
};

// ---------------------------------------------------------------------------
// saved drafts
// ---------------------------------------------------------------------------

export const listDrafts = async (): Promise<ServerResult<DraftSummary[]>> => {
  const result = await call<{ drafts: DraftSummary[] }>('/drafts');
  return result.ok ? { ok: true, value: result.value.drafts ?? [] } : result;
};

export const getDraft = (id: string): Promise<ServerResult<DraftDetail>> =>
  call<DraftDetail>(`/drafts/${id}`);

export const getVersion = (id: string, version: number): Promise<ServerResult<DraftVersion>> =>
  call<DraftVersion>(`/drafts/${id}/versions/${version}`);

/**
 * Start backing a draft up, or add a version to one already being backed up.
 *
 * `validateSaveDraft` runs here as well as on the server, and it is the same
 * function — so a payload past the size limit is refused without a round trip
 * and refused with the same words either way.
 */
export const createDraft = async (
  name: string,
  payload: string,
  note = 'first save'
): Promise<ServerResult<DraftDetail>> => {
  const checked = validateSaveDraft({ name, payload, note });
  if (!checked.ok) return { ok: false, code: 'bad-request', message: checked.message };
  return call<DraftDetail>('/drafts', { method: 'POST', body: checked.value });
};

export const saveVersion = async (
  id: string,
  payload: string,
  note = 'saved'
): Promise<ServerResult<DraftDetail>> => {
  const checked = validateSaveDraft({ payload, note });
  if (!checked.ok) return { ok: false, code: 'bad-request', message: checked.message };
  // The name is left out on purpose: an autosave carries the draft and nothing
  // else, and must not rename a draft the owner named by hand.
  return call<DraftDetail>(`/drafts/${id}`, {
    method: 'PUT',
    body: { payload: checked.value.payload, note: checked.value.note },
  });
};

export const renameDraft = (id: string, name: string): Promise<ServerResult<DraftDetail>> =>
  call<DraftDetail>(`/drafts/${id}`, { method: 'PATCH', body: { name } });

export const deleteDraft = (id: string): Promise<ServerResult<{ deleted: string }>> =>
  call<{ deleted: string }>(`/drafts/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// batch jobs
// ---------------------------------------------------------------------------

export const listJobs = async (): Promise<ServerResult<JobRecord[]>> => {
  const result = await call<{ jobs: JobRecord[] }>('/jobs');
  return result.ok ? { ok: true, value: result.value.jobs ?? [] } : result;
};

export const startJob = (
  kind: JobKind,
  options: JobOptions = {}
): Promise<ServerResult<JobLogResponse>> =>
  call<JobLogResponse>('/jobs', { method: 'POST', body: { kind, options } });

export const readJob = (id: string, since: number): Promise<ServerResult<JobLogResponse>> =>
  call<JobLogResponse>(`/jobs/${id}?since=${since}`);

export const cancelJob = (id: string): Promise<ServerResult<{ cancelled: string }>> =>
  call<{ cancelled: string }>(`/jobs/${id}/cancel`, { method: 'POST' });

/** The address a "use this page's origin" button should offer. */
export const sameOriginAddress = (): string => {
  try {
    return `${window.location.origin}${API_PREFIX}`;
  } catch {
    return API_PREFIX;
  }
};
