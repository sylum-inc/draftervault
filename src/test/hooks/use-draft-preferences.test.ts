import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftPreferences } from '@/hooks/use-draft-preferences';

const STORAGE_KEY = 'draft-vault:preferences:v1';
const MIGRATION_KEY = 'draft-vault:advisor-default:v2';

/**
 * A default that changed, reaching somebody who already has the app open.
 *
 * Preferences merge over the defaults and are written back on mount, so
 * everybody who has ever opened this app is carrying an explicit
 * `advisor: false` — the old default echoed back rather than a choice. Flipping
 * the default alone would therefore have reached nobody but a fresh browser,
 * which is not the person it was for.
 */
describe('the advisor default, once', () => {
  beforeEach(() => localStorage.clear());

  it('turns it on for a browser carrying the old default', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ advisor: false, clockSeconds: 45 }));
    const { result } = renderHook(() => useDraftPreferences());
    expect(result.current.preferences.advisor).toBe(true);
    // And touches nothing else it found there.
    expect(result.current.preferences.clockSeconds).toBe(45);
  });

  it('leaves it off once somebody has actually turned it off', () => {
    localStorage.setItem(MIGRATION_KEY, 'applied');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ advisor: false }));
    const { result } = renderHook(() => useDraftPreferences());
    expect(result.current.preferences.advisor).toBe(false);
  });

  it('applies once and then stays out of the way', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ advisor: false }));
    const first = renderHook(() => useDraftPreferences());
    expect(first.result.current.preferences.advisor).toBe(true);

    act(() => first.result.current.setAdvisor(false));
    first.unmount();

    const second = renderHook(() => useDraftPreferences());
    expect(second.result.current.preferences.advisor).toBe(false);
  });

  it('is on in a browser that has never seen the app', () => {
    const { result } = renderHook(() => useDraftPreferences());
    expect(result.current.preferences.advisor).toBe(true);
  });
});
