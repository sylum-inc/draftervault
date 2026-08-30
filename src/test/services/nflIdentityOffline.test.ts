import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { refreshIdentity } from '@/services/nflIdentity';

/**
 * The published artifact cannot reach anything, and must not try.
 *
 * Its CSP blocks every external host, and the live identity refresh asks for
 * all 32 NFL rosters — thirty-two requests that can only fail, each printed to
 * the console by the browser. That is the same reasoning the optional server's
 * discovery is built on: a page of red under a board somebody is drafting off
 * is a reason to distrust the board. The bundled snapshot paints real names,
 * colours and faces without any of it, which is why the artifact build embeds
 * the crests and faces in the first place.
 */
describe('the identity refresh where there is no network to use', () => {
  const flagged = globalThis as { __DV_OFFLINE__?: boolean };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete flagged.__DV_OFFLINE__;
  });

  it('makes no request at all when the build says there is nowhere to reach', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    flagged.__DV_OFFLINE__ = true;

    await expect(refreshIdentity()).resolves.toBe(0);

    // Not "the failure is handled" — no request was made.
    expect(fetched).not.toHaveBeenCalled();
  });

  it('still tries where a network might exist, because the injury merge is worth it', async () => {
    const fetched = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await refreshIdentity();

    expect(fetched).toHaveBeenCalled();
  });
});
