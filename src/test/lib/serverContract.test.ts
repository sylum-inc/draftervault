import { describe, it, expect } from 'vitest';
import {
  MAX_PAYLOAD_BYTES,
  SERVER_CONTRACT_VERSION,
  cleanDraftName,
  contractVerdict,
  isApiError,
  isDraftId,
  jobArgs,
  validateSaveDraft,
  validateStartJob,
} from '@/lib/serverContract';

/**
 * The wire, tested from the client's side of it.
 *
 * These are the same functions the server runs — it imports this module through
 * Node's type stripping, the way the pool builder imports `valuation.ts` — so
 * what is asserted here is asserted about both halves at once. That is the
 * whole reason the contract is one file: a test that only proved the client's
 * copy behaved would prove nothing about the half doing the writing.
 */
describe('the client and the server agreeing on a version', () => {
  it('accepts a server speaking our version', () => {
    const verdict = contractVerdict({
      kind: 'draft-vault-server',
      contract: SERVER_CONTRACT_VERSION,
      name: 'laptop',
      requiresToken: true,
      jobs: { pool: true, research: false },
      startedAt: '2026-08-29T10:00:00.000Z',
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.health.name).toBe('laptop');
      expect(verdict.health.requiresToken).toBe(true);
      expect(verdict.health.jobs.research).toBe(false);
    }
  });

  /**
   * The failure this exists for: two halves out of a single git checkout, one
   * of them not restarted. Guessing at the difference is what would put a draft
   * on disk in a shape the other half misreads, so the answer is to stop — and
   * to say which side is the stale one, because that is the whole of the fix.
   */
  it('refuses a server on a different version, and names the stale half', () => {
    const older = contractVerdict({
      kind: 'draft-vault-server',
      contract: SERVER_CONTRACT_VERSION - 1,
    });
    expect(older.ok).toBe(false);
    if (!older.ok) {
      expect(older.reason).toBe('contract-mismatch');
      expect(older.message).toContain('server');
      expect(older.message).toContain('Nothing was read or written');
    }

    const newer = contractVerdict({
      kind: 'draft-vault-server',
      contract: SERVER_CONTRACT_VERSION + 1,
    });
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.message).toContain('app');
  });

  it('does not mistake some other server for one of ours', () => {
    for (const answer of [null, 'hello', 42, {}, { kind: 'something-else', contract: 1 }]) {
      const verdict = contractVerdict(answer);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toBe('not-a-server');
    }
  });

  /**
   * A health response missing its optional halves still has to yield a usable
   * verdict: the handshake is the one thing a client of any version must be
   * able to read, so it degrades rather than rejecting.
   */
  it('reads a health response that carries only the frozen fields', () => {
    const verdict = contractVerdict({
      kind: 'draft-vault-server',
      contract: SERVER_CONTRACT_VERSION,
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.health.requiresToken).toBe(false);
      expect(verdict.health.jobs).toEqual({ pool: false, research: false });
    }
  });
});

describe('what may be saved', () => {
  it('needs a payload and nothing else', () => {
    const checked = validateSaveDraft({ payload: '{"kind":"draft-vault-draft"}' });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.value.name).toBe('Untitled draft');
  });

  it('refuses a save with nothing in it', () => {
    expect(validateSaveDraft({ payload: '' }).ok).toBe(false);
    expect(validateSaveDraft({ payload: '   ' }).ok).toBe(false);
    expect(validateSaveDraft({}).ok).toBe(false);
    expect(validateSaveDraft(null).ok).toBe(false);
  });

  /**
   * The limit is counted in bytes, not characters. A team named in emoji is
   * four bytes a character, so a UTF-16 length would let something through at
   * four times the size it claimed.
   */
  it('measures the payload in bytes', () => {
    const wide = '🏈'.repeat(MAX_PAYLOAD_BYTES / 4 + 10);
    expect(wide.length).toBeLessThan(MAX_PAYLOAD_BYTES);
    const checked = validateSaveDraft({ payload: wide });
    expect(checked.ok).toBe(false);
  });

  it('tidies a name rather than rejecting it', () => {
    expect(cleanDraftName('  Friday    night  ', 'x')).toBe('Friday night');
    expect(cleanDraftName('', 'fallback')).toBe('fallback');
    expect(cleanDraftName(null, 'fallback')).toBe('fallback');
    expect(cleanDraftName('a'.repeat(500), 'x')).toHaveLength(120);
  });

  /**
   * An id becomes a directory name on the server, so it is checked on the way
   * back in rather than trusted. Nothing that can spell a path traversal gets
   * through the alphabet.
   */
  it('only accepts ids that cannot name a path', () => {
    expect(isDraftId('a1b2c3d4')).toBe(true);
    expect(isDraftId('0123456789abcdef')).toBe(true);
    expect(isDraftId('../../etc/passwd')).toBe(false);
    expect(isDraftId('..')).toBe(false);
    expect(isDraftId('a/b')).toBe(false);
    expect(isDraftId('short')).toBe(false);
    expect(isDraftId('A1B2C3D4')).toBe(false);
    expect(isDraftId(42)).toBe(false);
  });
});

describe('what a job may be asked to do', () => {
  it('takes the two jobs and refuses anything else', () => {
    expect(validateStartJob({ kind: 'pool' }).ok).toBe(true);
    expect(validateStartJob({ kind: 'research' }).ok).toBe(true);
    expect(validateStartJob({ kind: 'rm' }).ok).toBe(false);
    expect(validateStartJob({}).ok).toBe(false);
  });

  it('bounds the options it accepts', () => {
    expect(validateStartJob({ kind: 'research', options: { limit: 25 } }).ok).toBe(true);
    expect(validateStartJob({ kind: 'research', options: { limit: 0 } }).ok).toBe(false);
    expect(validateStartJob({ kind: 'research', options: { limit: 99999 } }).ok).toBe(false);
    expect(validateStartJob({ kind: 'research', options: { position: 'wr' } }).ok).toBe(true);
    expect(validateStartJob({ kind: 'research', options: { position: 'QUARTERBACK' } }).ok).toBe(
      false
    );
  });

  /**
   * The one that matters. The job routes are behind a token, but a token behind
   * a public tunnel is one leak away from being a stranger's — and the gap
   * between "they can rebuild my player pool" and "they can run anything on my
   * laptop" is this function refusing to pass a caller's string through.
   */
  it('never lets a caller put a string on the command line', () => {
    const hostile = validateStartJob({
      kind: 'research',
      options: { position: 'WR; rm -rf ~', limit: '5; curl evil.example' },
    });
    expect(hostile.ok).toBe(false);

    // Even if something did get past validation, the argv is composed here from
    // values this module produced, never from the ones it was handed.
    const args = jobArgs('research', { position: 'WR', limit: 5, refresh: true }, '/tmp/staging');
    expect(args).toEqual([
      '--out',
      '/tmp/staging/research.json',
      '--limit',
      '5',
      '--position',
      'WR',
      '--all',
    ]);
    for (const arg of args) expect(arg).not.toMatch(/[;&|`$]/);
  });

  it('sends the pool build at a directory and the research at a file', () => {
    expect(jobArgs('pool', {}, '/tmp/s')).toEqual(['--out', '/tmp/s']);
    expect(jobArgs('pool', { offline: true }, '/tmp/s')).toEqual(['--out', '/tmp/s', '--offline']);
    expect(jobArgs('research', {}, '/tmp/s')).toEqual(['--out', '/tmp/s/research.json']);
  });
});

describe('errors', () => {
  it('recognises the shape it defines', () => {
    expect(isApiError({ error: { code: 'not-found', message: 'nope' } })).toBe(true);
    expect(isApiError({ error: 'nope' })).toBe(false);
    expect(isApiError({})).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
