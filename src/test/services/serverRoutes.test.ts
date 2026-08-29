import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../../../server/api.mjs';
import { createStore } from '../../../server/store.mjs';
import { SERVER_CONTRACT_VERSION } from '@/lib/serverContract';

/**
 * The server's routes, driven with nothing listening on any port.
 *
 * `createApi` is a function from a request to a response and owns no socket,
 * which is what makes this possible at all — and the reason it was written that
 * way. The thing being guarded against is a laptop with no server running, so
 * "start a server and curl it" is exactly the test that cannot be part of
 * `npm run validate`. The store is real, against a temporary directory, because
 * the version history is the feature and an in-memory fake of it would prove
 * nothing about what survives a crash.
 *
 * The job runner is a stub. Spawning the real pool builder downloads nineteen
 * megabytes of play-by-play; what is under test here is the routing and the
 * refusals, and `serverContract.test.ts` covers the argv those refusals protect.
 */

const request = (over: Record<string, unknown> = {}) => ({
  method: 'GET',
  path: '/api/health',
  query: {},
  body: undefined,
  authorization: undefined,
  contract: String(SERVER_CONTRACT_VERSION),
  ...over,
});

const stubJobs = () => {
  const started: Array<{ kind: string; options: unknown }> = [];
  return {
    started,
    list: () => [],
    start(kind: string, options: unknown) {
      started.push({ kind, options });
      return {
        ok: true,
        job: {
          id: 'abc123',
          kind,
          state: 'running',
          startedAt: '2026-08-29T10:00:00.000Z',
          finishedAt: null,
          exitCode: null,
          outDir: '/tmp/staging/abc123',
          lines: 0,
        },
      };
    },
    read: (id: string) =>
      id === 'abc123' ? { job: { id, state: 'running' }, from: 0, lines: ['building…'] } : null,
    cancel: (id: string) => id === 'abc123',
  };
};

/** Composed the way `index.mjs` composes it: a boolean about the token, never it. */
const healthFor = (token: string | null) => () => ({
  kind: 'draft-vault-server',
  contract: SERVER_CONTRACT_VERSION,
  name: 'test',
  requiresToken: !!token,
  jobs: { pool: true, research: true },
  startedAt: '2026-08-29T10:00:00.000Z',
});

let root: string;
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'draft-vault-test-'));
  store = createStore(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const openApi = (token: string | null = null) =>
  createApi({ store, jobs: stubJobs(), token, health: healthFor(token) });

const PAYLOAD = JSON.stringify({ kind: 'draft-vault-draft', version: 1, picks: [] });

describe('the handshake', () => {
  it('answers without a token even when the server wants one everywhere else', async () => {
    const api = openApi('secret');
    const result = await api(request({ path: '/api/health', contract: undefined }));
    expect(result.status).toBe(200);
    expect(result.body.kind).toBe('draft-vault-server');
  });

  /**
   * The handshake is how a client finds out that a token is wanted, so it has
   * to say that much — and nothing more. There is no route in the whole
   * contract that returns a secret; this asserts the one route a stranger can
   * reach carries no trace of the two this process holds.
   */
  it('says a token is wanted without ever saying what it is', async () => {
    const api = createApi({
      store,
      jobs: stubJobs(),
      token: 'sk-super-secret',
      health: healthFor('sk-super-secret'),
    });
    const result = await api(request({ path: '/api/health' }));
    expect(result.body.requiresToken).toBe(true);
    // The value itself appears nowhere, and neither does the OpenRouter key
    // the research job runs with — `jobs.research` is a boolean about it.
    const text = JSON.stringify(result.body);
    expect(text).not.toContain('sk-super-secret');
    expect(text).not.toMatch(/sk-[a-z-]/);
    expect(typeof result.body.jobs.research).toBe('boolean');
  });
});

describe('the token', () => {
  it('lets nothing but the handshake through without one', async () => {
    const api = openApi('secret');
    for (const path of ['/api/drafts', '/api/jobs']) {
      const result = await api(request({ path }));
      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe('unauthorized');
    }
  });

  it('refuses a wrong one and accepts the right one', async () => {
    const api = openApi('secret');
    expect(
      (await api(request({ path: '/api/drafts', authorization: 'Bearer wrong' }))).status
    ).toBe(401);
    expect(
      (await api(request({ path: '/api/drafts', authorization: 'Bearer secret' }))).status
    ).toBe(200);
  });

  it('needs no token at all when the server was started without one', async () => {
    const result = await openApi(null)(request({ path: '/api/drafts' }));
    expect(result.status).toBe(200);
    expect(result.body.drafts).toEqual([]);
  });
});

describe('a stale half', () => {
  it('is turned away before it can write', async () => {
    const api = openApi(null);
    const result = await api(
      request({
        method: 'POST',
        path: '/api/drafts',
        body: { name: 'x', payload: PAYLOAD },
        contract: String(SERVER_CONTRACT_VERSION + 1),
      })
    );
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('contract-mismatch');
    // And nothing landed on the disk.
    expect(store.list()).toHaveLength(0);
  });
});

describe('saved drafts', () => {
  it('creates, lists, fetches and deletes one', async () => {
    const api = openApi(null);

    const created = await api(
      request({ method: 'POST', path: '/api/drafts', body: { name: 'Friday', payload: PAYLOAD } })
    );
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(created.body.name).toBe('Friday');
    expect(created.body.versions).toBe(1);

    const listed = await api(request({ path: '/api/drafts' }));
    expect(listed.body.drafts).toHaveLength(1);
    expect(listed.body.drafts[0].id).toBe(id);

    const fetched = await api(request({ path: `/api/drafts/${id}` }));
    expect(fetched.status).toBe(200);
    expect(fetched.body.history).toHaveLength(1);

    const removed = await api(request({ method: 'DELETE', path: `/api/drafts/${id}` }));
    expect(removed.status).toBe(200);
    expect((await api(request({ path: '/api/drafts' }))).body.drafts).toHaveLength(0);
  });

  /**
   * The owner asked for history because losing an afternoon is expensive and a
   * save is cheap. So a save is never a rewrite: every version stays reachable,
   * and the bytes that come back out are the bytes that went in.
   */
  it('keeps every version, and hands each one back exactly as it went in', async () => {
    const api = openApi(null);
    const id = (
      await api(
        request({ method: 'POST', path: '/api/drafts', body: { name: 'Friday', payload: 'one' } })
      )
    ).body.id;

    for (const payload of ['two', 'three']) {
      await api(request({ method: 'PUT', path: `/api/drafts/${id}`, body: { payload } }));
    }

    const detail = await api(request({ path: `/api/drafts/${id}` }));
    expect(detail.body.versions).toBe(3);
    // Newest first, which is the order somebody scrolling back wants them in.
    expect(detail.body.history.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);

    for (const [version, expected] of [
      [1, 'one'],
      [2, 'two'],
      [3, 'three'],
    ] as const) {
      const stored = await api(request({ path: `/api/drafts/${id}/versions/${version}` }));
      expect(stored.status).toBe(200);
      expect(stored.body.payload).toBe(expected);
    }
  });

  /**
   * An autosave carries the draft and nothing else. Letting it also carry a
   * name would mean the backup quietly renaming a draft the owner named by
   * hand, which is the sort of thing nobody notices until the list is useless.
   */
  it('does not let a save without a name rename the draft', async () => {
    const api = openApi(null);
    const id = (
      await api(
        request({ method: 'POST', path: '/api/drafts', body: { name: 'Friday', payload: 'one' } })
      )
    ).body.id;

    const after = await api(
      request({ method: 'PUT', path: `/api/drafts/${id}`, body: { payload: 'two' } })
    );
    expect(after.body.name).toBe('Friday');

    const renamed = await api(
      request({ method: 'PATCH', path: `/api/drafts/${id}`, body: { name: 'Saturday' } })
    );
    expect(renamed.body.name).toBe('Saturday');
    // A rename adds no version: it changed nothing about the draft itself, and
    // the two versions that exist are the two saves that were actually made.
    expect(renamed.body.versions).toBe(2);
  });

  /**
   * The server never parses a payload — it is a filing cabinet, not a second
   * engine — so anything at all round-trips, and deciding whether it describes
   * a legal draft stays the one job of `importDraft` on the way back in.
   */
  it('stores a payload it cannot understand, byte for byte', async () => {
    const api = openApi(null);
    const nonsense = 'not json at all, {{{ ';
    const id = (
      await api(
        request({ method: 'POST', path: '/api/drafts', body: { name: 'x', payload: nonsense } })
      )
    ).body.id;
    const back = await api(request({ path: `/api/drafts/${id}/versions/1` }));
    expect(back.body.payload).toBe(nonsense);
  });

  it('refuses a save with no draft in it', async () => {
    const result = await openApi(null)(
      request({ method: 'POST', path: '/api/drafts', body: { name: 'x' } })
    );
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('bad-request');
  });

  /**
   * An id becomes a directory name. A request that spelled one as a path would
   * be a request to read or delete somewhere else on the disk entirely.
   */
  it('will not follow an id out of the store', async () => {
    const api = openApi(null);
    for (const id of ['..', '../..', '..%2f..', 'a/b']) {
      const result = await api(request({ path: `/api/drafts/${id}` }));
      expect(result.status).toBe(404);
    }
    // And a delete cannot reach the directory above the drafts either.
    await api(request({ method: 'DELETE', path: '/api/drafts/..' }));
    expect(existsSync(join(root, 'drafts'))).toBe(true);
  });

  it('says not-found rather than inventing an empty draft', async () => {
    const api = openApi(null);
    expect((await api(request({ path: '/api/drafts/0123456789abcdef' }))).status).toBe(404);
    expect((await api(request({ path: '/api/drafts/0123456789abcdef/versions/9' }))).status).toBe(
      404
    );
  });

  /** A version file is written before the index that names it, never after. */
  it('leaves a readable index and one file per version on disk', () => {
    const created = store.create({ name: 'Friday', payload: 'one', note: 'saved' });
    store.addVersion(created.id, { payload: 'two', note: 'autosave' });
    const files = readdirSync(join(root, 'drafts', created.id)).sort();
    expect(files).toEqual(['meta.json', 'v0001.json', 'v0002.json']);
  });
});

describe('jobs', () => {
  it('starts one and reports it', async () => {
    const api = openApi(null);
    const started = await api(
      request({ method: 'POST', path: '/api/jobs', body: { kind: 'pool' } })
    );
    expect(started.status).toBe(202);
    expect(started.body.job.kind).toBe('pool');

    const read = await api(request({ path: '/api/jobs/abc123', query: { since: '0' } }));
    expect(read.status).toBe(200);
    expect(read.body.lines).toEqual(['building…']);

    const cancelled = await api(request({ method: 'POST', path: '/api/jobs/abc123/cancel' }));
    expect(cancelled.status).toBe(200);
  });

  it('refuses a job that is not one of the two', async () => {
    const result = await openApi(null)(
      request({ method: 'POST', path: '/api/jobs', body: { kind: 'shell' } })
    );
    expect(result.status).toBe(400);
  });

  it('passes only checked options through to the runner', async () => {
    const jobs = stubJobs();
    const api = createApi({ store, jobs, token: null, health: healthFor(null) });
    await api(
      request({
        method: 'POST',
        path: '/api/jobs',
        body: { kind: 'research', options: { limit: 10, position: 'wr', nonsense: 'rm -rf /' } },
      })
    );
    expect(jobs.started).toEqual([{ kind: 'research', options: { limit: 10, position: 'WR' } }]);
  });
});

describe('anything else', () => {
  it('is a plain not-found rather than a stack trace', async () => {
    const result = await openApi(null)(request({ path: '/api/whatever' }));
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('not-found');
  });
});
