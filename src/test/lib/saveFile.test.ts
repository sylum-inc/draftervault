import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveTextFile } from '@/lib/saveFile';

/**
 * jsdom implements neither `createObjectURL` nor `revokeObjectURL`, so the
 * browser path has to be stubbed in rather than spied on.
 */
const stubObjectUrls = () => {
  const url = URL as unknown as Record<string, unknown>;
  url.createObjectURL = vi.fn(() => 'blob:test');
  url.revokeObjectURL = vi.fn();
};

/** A rejection shaped like the runtime's, which callers branch on by `code`. */
const refusal = (code: string) => Object.assign(new Error(code), { code });

const withRuntime = (use: (name: string) => Promise<unknown>) => {
  (globalThis as { claude?: unknown }).claude = { use };
};

afterEach(() => {
  delete (globalThis as { claude?: unknown }).claude;
  const url = URL as unknown as Record<string, unknown>;
  delete url.createObjectURL;
  delete url.revokeObjectURL;
  vi.restoreAllMocks();
});

describe('saveTextFile inside the artifact viewer', () => {
  it('saves through the viewer when the capability is there', async () => {
    const save = vi.fn().mockResolvedValue({ status: 'saved' });
    withRuntime(async () => ({ save }));

    const outcome = await saveTextFile('results.csv', 'a,b\n1,2');

    expect(outcome).toEqual({ status: 'saved', filename: 'results.csv' });
    expect(save).toHaveBeenCalledWith({ filename: 'results.csv', data: 'a,b\n1,2' });
  });

  it('falls back to a plain-text extension when csv is refused', async () => {
    // csv sits in the capability's extended set, which a view may not enable.
    // The same bytes under a base-set extension still open in a spreadsheet.
    const save = vi
      .fn()
      .mockRejectedValueOnce(refusal('extension_not_enabled'))
      .mockResolvedValueOnce({ status: 'saved' });
    withRuntime(async () => ({ save }));

    const outcome = await saveTextFile('results.csv', 'a,b');

    expect(outcome).toEqual({ status: 'saved', filename: 'results.txt' });
    expect(save).toHaveBeenNthCalledWith(2, { filename: 'results.txt', data: 'a,b' });
  });

  it('does not ask twice when the viewer declines', async () => {
    const save = vi.fn().mockRejectedValue(refusal('declined'));
    withRuntime(async () => ({ save }));

    expect(await saveTextFile('results.csv', 'a,b')).toEqual({ status: 'declined' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not ask twice when prompts are rate limited', async () => {
    const save = vi.fn().mockRejectedValue(refusal('rate_limited'));
    withRuntime(async () => ({ save }));

    expect(await saveTextFile('results.csv', 'a,b')).toEqual({ status: 'declined' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports a failure the caller should offer Copy for', async () => {
    const save = vi.fn().mockRejectedValue(refusal('too_large'));
    withRuntime(async () => ({ save }));

    expect(await saveTextFile('results.csv', 'a,b')).toMatchObject({
      status: 'failed',
      reason: 'too_large',
    });
  });

  it('gives up cleanly when both extensions are refused', async () => {
    const save = vi.fn().mockRejectedValue(refusal('rejected_extension'));
    withRuntime(async () => ({ save }));

    expect(await saveTextFile('results.csv', 'a,b')).toMatchObject({ status: 'failed' });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('falls back to the browser when the capability is not granted', async () => {
    // `use()` resolving null is how a view says it cannot run the capability.
    withRuntime(async () => null);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    stubObjectUrls();

    expect(await saveTextFile('results.csv', 'a,b')).toEqual({
      status: 'saved',
      filename: 'results.csv',
    });
    expect(click).toHaveBeenCalled();
  });
});

describe('saveTextFile in an ordinary browser', () => {
  it('downloads through an anchor when there is no runtime at all', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    stubObjectUrls();

    expect(await saveTextFile('results.csv', 'a,b')).toEqual({
      status: 'saved',
      filename: 'results.csv',
    });
    expect(click).toHaveBeenCalledTimes(1);
  });
});
