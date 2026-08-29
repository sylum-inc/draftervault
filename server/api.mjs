/**
 * The routes, as a function from a request to a response.
 *
 * Deliberately knows nothing about sockets. `createApi` takes a store, a job
 * runner and a token and hands back one `async (request) => { status, body }`,
 * so the whole routing surface can be driven from a test with nothing
 * listening on any port — which is the only way the route handling gets tested
 * at all, given that the thing being guarded against is a laptop with no server
 * on it. `index.mjs` is the part that owns a port, and it is thin on purpose.
 *
 * Every shape crossing this boundary is defined in `src/lib/serverContract.ts`
 * and validated by functions from it, so the check the client runs before
 * sending and the check the server runs on arrival are the same code.
 */
import { timingSafeEqual } from 'node:crypto';

import {
  HTTP_STATUS,
  SERVER_CONTRACT_VERSION,
  apiError,
  cleanDraftName,
  isDraftId,
  validateSaveDraft,
  validateStartJob,
} from '../src/lib/serverContract.ts';

/**
 * Compare two tokens without leaking their difference in the time taken.
 *
 * Overkill for one person behind a tunnel, and it costs four lines. The reason
 * to write it anyway is that the tunnel is public: the token is the only thing
 * between the internet and this store, so it gets compared the way a secret is
 * compared rather than the way a string is.
 */
const tokenMatches = (expected, offered) => {
  if (typeof offered !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(offered, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

const bearer = (authorization) => {
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1] : null;
};

const no = (code, message) => ({ status: HTTP_STATUS[code], body: apiError(code, message) });

/** Segments of the path below `/api`, with empties dropped. */
const segments = (path) =>
  path
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean);

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const createApi = ({ store, jobs, token, health }) => {
  return async (request) => {
    const { method, path } = request;
    const parts = segments(path);

    // The handshake is the one thing an unauthenticated caller may have, and it
    // has to be, because a client cannot know whether a token is wanted until
    // something tells it. It says nothing about the drafts or the machine.
    if (parts.length === 1 && parts[0] === 'health' && method === 'GET') {
      // What a caller learns before proving who they are: that this is a Draft
      // Vault server, which contract it speaks, and whether it wants a token.
      // Not what jobs it can run — that reported whether this machine holds a
      // paid OpenRouter key, which over a public tunnel is an advertisement.
      // The panel re-reads capabilities once it is authenticated.
      const full = health();
      const authenticated = !token || tokenMatches(token, bearer(request.authorization));
      return {
        status: 200,
        body: authenticated ? full : { ...full, jobs: { pool: false, research: false } },
      };
    }

    /**
     * A stale half, caught before it writes.
     *
     * The client checks the contract at the handshake and refuses to go on if
     * it differs, so this header should never disagree. It is checked anyway on
     * anything that writes, because the failure being prevented is a draft
     * landing on disk in a shape the other half will misread, and the whole
     * value of the store is that what comes out of it is what went in.
     */
    const claimed = request.contract;
    if (claimed !== undefined && claimed !== null && Number(claimed) !== SERVER_CONTRACT_VERSION) {
      return no(
        'contract-mismatch',
        `This server speaks contract ${SERVER_CONTRACT_VERSION}; that request claimed ${claimed}. Nothing was read or written.`
      );
    }
    // Required on every write whether or not a token is set, and that is a
    // security control rather than a version check. A custom header cannot be
    // sent cross-origin without a preflight, and the preflight consults the
    // origin allowlist — so demanding it is what makes a hostile page in
    // another tab unable to POST here. Gating it on a token meant the
    // documented quick start, which sets no token, accepted a cross-site write
    // as a simple form post while the docs claimed CSRF was impossible by
    // construction.
    if (WRITE_METHODS.has(method) && (claimed === undefined || claimed === null)) {
      return no(
        'contract-mismatch',
        'A write has to say which contract version it was written against.'
      );
    }

    if (token && !tokenMatches(token, bearer(request.authorization))) {
      return no(
        'unauthorized',
        'This server wants its shared token. Set it in the server panel, or start the server without DRAFT_VAULT_TOKEN to work without one.'
      );
    }

    // ---- drafts ----------------------------------------------------------

    if (parts[0] === 'drafts') {
      if (parts.length === 1) {
        if (method === 'GET') {
          return { status: 200, body: { contract: SERVER_CONTRACT_VERSION, drafts: store.list() } };
        }
        if (method === 'POST') {
          const checked = validateSaveDraft(request.body);
          if (!checked.ok) return no('bad-request', checked.message);
          return { status: 201, body: store.create(checked.value) };
        }
        return no('bad-request', `${method} is not something ${path} does.`);
      }

      const id = parts[1];
      if (!isDraftId(id)) return no('not-found', 'No draft has that id.');

      if (parts.length === 2) {
        if (method === 'GET') {
          const draft = store.get(id);
          return draft ? { status: 200, body: draft } : no('not-found', 'No draft has that id.');
        }
        if (method === 'PUT') {
          const checked = validateSaveDraft(request.body);
          if (!checked.ok) return no('bad-request', checked.message);
          // A name is only replaced when one was actually sent: an autosave
          // carries the draft and nothing else, and it must not quietly rename
          // a draft somebody named by hand.
          const named =
            typeof request.body?.name === 'string' && request.body.name.trim()
              ? checked.value.name
              : undefined;
          const draft = store.addVersion(id, { ...checked.value, name: named });
          return draft ? { status: 200, body: draft } : no('not-found', 'No draft has that id.');
        }
        if (method === 'PATCH') {
          const name = cleanDraftName(request.body?.name, '');
          if (!name) return no('bad-request', 'A rename needs a name.');
          const draft = store.rename(id, name);
          return draft ? { status: 200, body: draft } : no('not-found', 'No draft has that id.');
        }
        if (method === 'DELETE') {
          return store.remove(id)
            ? { status: 200, body: { contract: SERVER_CONTRACT_VERSION, deleted: id } }
            : no('not-found', 'No draft has that id.');
        }
        return no('bad-request', `${method} is not something ${path} does.`);
      }

      if (parts.length === 4 && parts[2] === 'versions' && method === 'GET') {
        const version = store.version(id, Number.parseInt(parts[3], 10));
        return version
          ? { status: 200, body: version }
          : no('not-found', 'That draft has no such version.');
      }

      return no('not-found', `Nothing answers at ${path}.`);
    }

    // ---- jobs ------------------------------------------------------------

    if (parts[0] === 'jobs') {
      if (parts.length === 1) {
        if (method === 'GET') {
          return { status: 200, body: { contract: SERVER_CONTRACT_VERSION, jobs: jobs.list() } };
        }
        if (method === 'POST') {
          const checked = validateStartJob(request.body);
          if (!checked.ok) return no('bad-request', checked.message);
          const started = jobs.start(checked.value.kind, checked.value.options);
          if (!started.ok) return no(started.code, started.message);
          return {
            status: 202,
            body: { contract: SERVER_CONTRACT_VERSION, job: started.job, from: 0, lines: [] },
          };
        }
        return no('bad-request', `${method} is not something ${path} does.`);
      }

      const id = parts[1];
      if (parts.length === 2 && method === 'GET') {
        const since = Number.parseInt(request.query?.since ?? '0', 10);
        const read = jobs.read(id, Number.isFinite(since) ? since : 0);
        return read
          ? { status: 200, body: { contract: SERVER_CONTRACT_VERSION, ...read } }
          : no('not-found', 'No job has that id.');
      }
      if (parts.length === 3 && parts[2] === 'cancel' && method === 'POST') {
        return jobs.cancel(id)
          ? { status: 200, body: { contract: SERVER_CONTRACT_VERSION, cancelled: id } }
          : no('not-found', 'No job has that id, or it had already stopped.');
      }
      return no('not-found', `Nothing answers at ${path}.`);
    }

    return no('not-found', `Nothing answers at ${path}.`);
  };
};
