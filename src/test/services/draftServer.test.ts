import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  createDraft,
  describeServer,
  isConfigured,
  listDrafts,
  saveVersion,
  serverConfig,
  setServerBinding,
  setServerConfig,
} from '@/services/draftServer';
import { useDraftServer } from '@/hooks/use-draft-server';
import { SERVER_CONTRACT_VERSION } from '@/lib/serverContract';
import type { AuctionDraftService } from '@/services/auctionDraftService';

/**
 * The client half of the seam, and mostly the half that does nothing.
 *
 * Solo mode is the hard constraint on all of this: the app has to work exactly
 * as it did with no server running, no account and no network, and that is the
 * state draft night falls back to if anything goes wrong. So the first group
 * below is not a corner case — it is the ordinary condition, asserted as such.
 * The bar it sets is deliberately higher than "handles the failure": with
 * nothing configured, no request is made at all, because a request that fails
 * still prints a red line to the console of an app somebody is drafting off.
 */

const health = {
  kind: 'draft-vault-server',
  contract: SERVER_CONTRACT_VERSION,
  name: 'laptop',
  requiresToken: false,
  jobs: { pool: true, research: false },
  startedAt: '2026-08-29T10:00:00.000Z',
};

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;
let noise: Array<unknown[]>;
let restoreConsole: () => void;

beforeEach(() => {
  localStorage.clear();
  document.head.querySelectorAll('meta[name="draft-vault-server"]').forEach((el) => el.remove());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  // Anything printed while there is no server is itself the bug: a console
  // error under a live draft board is a reason to distrust the board.
  noise = [];
  const error = console.error;
  const warn = console.warn;
  console.error = (...args: unknown[]) => noise.push(args);
  console.warn = (...args: unknown[]) => noise.push(args);
  restoreConsole = () => {
    console.error = error;
    console.warn = warn;
  };
});

afterEach(() => {
  restoreConsole();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Only the two methods the hook touches; the engine itself is not under test. */
const stubService = () => {
  const subscribers = new Set<() => void>();
  return {
    // Deliberately not called `listeners`: the real engine has a private field
    // of that name, and an intersection type that collides with a private
    // member collapses to `never`.
    subscribers,
    exportDraft: () => '{"kind":"draft-vault-draft","picks":[]}',
    addChangeListener(listener: () => void) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
  } as unknown as AuctionDraftService & { subscribers: Set<() => void> };
};

describe('with no server, which is the ordinary state', () => {
  it('is not configured, and says so without asking anybody', () => {
    expect(isConfigured()).toBe(false);
    expect(serverConfig()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes no request at all — not a failed one', async () => {
    expect(await describeServer()).toEqual({ state: 'off' });
    expect(await listDrafts()).toMatchObject({ ok: false, code: 'no-server' });
    expect(await createDraft('x', 'y')).toMatchObject({ ok: false, code: 'no-server' });
    expect(await saveVersion('0123456789abcdef', 'y')).toMatchObject({
      ok: false,
      code: 'no-server',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says nothing to the console', async () => {
    await describeServer();
    await listDrafts();
    expect(noise).toEqual([]);
  });

  /**
   * The hook is the part that runs on every load of the draft room, so this is
   * the assertion that matters most: with no server it subscribes to nothing.
   * Not "subscribes and returns early" — nothing is on the engine's listener
   * set, so a pick costs exactly what it cost before any of this existed, and
   * there is no timer ticking under an auction.
   */
  it('subscribes to nothing and starts no timer', async () => {
    const service = stubService();
    const { result, unmount } = renderHook(() => useDraftServer(service));

    await waitFor(() => expect(result.current.discovery.state).toBe('off'));
    expect(service.subscribers.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(noise).toEqual([]);
    unmount();
  });
});

describe('finding a server that was pointed at', () => {
  beforeEach(() => {
    setServerConfig({ url: 'http://127.0.0.1:8788/api', token: '' });
  });

  it('asks the handshake and accepts a matching one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(health));
    const found = await describeServer();
    expect(found.state).toBe('ready');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8788/api/health');
  });

  it('reports a server that did not answer, without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const found = await describeServer();
    expect(found.state).toBe('unreachable');
    // The message has to say the draft is fine, because that is the fact the
    // owner needs at the moment he sees it.
    if (found.state === 'unreachable') expect(found.message).toContain('draft is safe');
    expect(noise).toEqual([]);
  });

  it('refuses a server on another contract version rather than guessing', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...health, contract: SERVER_CONTRACT_VERSION + 1 })
    );
    const found = await describeServer();
    expect(found.state).toBe('incompatible');
  });

  it('refuses whatever else happens to be on that port', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: 'world' }));
    expect((await describeServer()).state).toBe('incompatible');
  });

  /** The token goes in a header, never in a URL, and never near a cookie. */
  it('sends the token as a header and no credentials', async () => {
    setServerConfig({ url: 'http://127.0.0.1:8788/api', token: 'hunter2' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ drafts: [] }));
    await listDrafts();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('hunter2');
    expect(init.headers.Authorization).toBe('Bearer hunter2');
    expect(init.headers['X-Draft-Vault-Contract']).toBe(String(SERVER_CONTRACT_VERSION));
    expect(init.credentials).toBe('omit');
  });

  it('passes a typed failure back rather than a status code', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'unauthorized', message: 'wants its token' } }, 401)
    );
    expect(await listDrafts()).toMatchObject({ ok: false, code: 'unauthorized' });
  });

  /** Checked with the server's own function, so no round trip and no drift. */
  it('refuses an oversized save before sending it', async () => {
    const huge = 'x'.repeat(5 * 1024 * 1024);
    const result = await createDraft('big', huge);
    expect(result).toMatchObject({ ok: false, code: 'bad-request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('where the address comes from', () => {
  it('reads one the server injected into the page it served', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'draft-vault-server');
    meta.setAttribute('content', '/api');
    document.head.appendChild(meta);
    expect(serverConfig()).toEqual({ url: '/api', token: '' });
  });

  it('lets what was typed win over what the page was served with', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'draft-vault-server');
    meta.setAttribute('content', '/api');
    document.head.appendChild(meta);
    setServerConfig({ url: 'http://127.0.0.1:8788/api/', token: 't' });
    // And a trailing slash is trimmed, so joining a path cannot double it.
    expect(serverConfig()).toEqual({ url: 'http://127.0.0.1:8788/api', token: 't' });
  });
});

describe('backing the draft up as it is played', () => {
  beforeEach(() => {
    setServerConfig({ url: '/api', token: '' });
    setServerBinding({ id: '0123456789abcdef', name: 'Friday' });
  });

  /**
   * The subscription goes on through `addChangeListener`, which returns an
   * unsubscribe and is a Set. `setChangeListener` clears that Set, and the
   * second-window sync is already on it — whichever mounted second would have
   * silently taken the other's slot, leaving a television that stopped
   * following or a backup that stopped being written, with nothing on screen
   * either way.
   */
  it("joins the engine's listeners rather than displacing them", async () => {
    const service = stubService();
    const somebodyElse = vi.fn();
    service.addChangeListener(somebodyElse);

    fetchMock.mockResolvedValue(jsonResponse(health));
    const { result, unmount } = renderHook(() => useDraftServer(service));
    await waitFor(() => expect(result.current.discovery.state).toBe('ready'));

    expect(service.subscribers.size).toBe(2);
    unmount();
    // And it takes only its own away again.
    expect(service.subscribers.size).toBe(1);
  });

  it('writes a version a moment after the draft moves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const service = stubService();
    fetchMock.mockResolvedValue(jsonResponse(health));

    const { result, unmount } = renderHook(() => useDraftServer(service));
    await waitFor(() => expect(result.current.discovery.state).toBe('ready'));

    fetchMock.mockResolvedValue(jsonResponse({ id: '0123456789abcdef', versions: 4 }));
    act(() => {
      // Three picks in quick succession, as a hot auction produces.
      for (const listener of service.subscribers) listener();
      for (const listener of service.subscribers) listener();
      for (const listener of service.subscribers) listener();
    });

    const before = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    const saves = fetchMock.mock.calls.slice(before);
    // Coalesced into one save, not three.
    expect(saves).toHaveLength(1);
    expect(String(saves[0][0])).toBe('/api/drafts/0123456789abcdef');
    expect(saves[0][1].method).toBe('PUT');
    // An autosave carries the draft and no name: renaming a draft the owner
    // named by hand is not something a backup gets to do.
    expect(JSON.parse(saves[0][1].body)).not.toHaveProperty('name');

    unmount();
    vi.useRealTimers();
  });

  /**
   * A tunnel that has dropped does not come back because a fourth pick was
   * made. Trying once per pick for the rest of the night is a request per pick
   * that can time out and take attention at the worst possible moment, so it
   * gives up and says so — and the draft is untouched either way, because it
   * was never anywhere but localStorage.
   */
  it('stops trying after a run of failures, and says the draft is safe', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const service = stubService();
    fetchMock.mockResolvedValue(jsonResponse(health));

    const { result, unmount } = renderHook(() => useDraftServer(service));
    await waitFor(() => expect(result.current.discovery.state).toBe('ready'));

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    for (let attempt = 0; attempt < 5; attempt++) {
      act(() => {
        for (const listener of service.subscribers) listener();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
    }

    expect(result.current.backup.state).toBe('stopped');
    expect(result.current.backup.message).toContain('safe in this browser');
    expect(noise).toEqual([]);

    unmount();
    vi.useRealTimers();
  });
});
