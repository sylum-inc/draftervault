import { useCallback, useEffect, useState } from 'react';

/**
 * Per-person preferences: which board you like, who you are watching, what you
 * are queued up to nominate.
 *
 * Deliberately separate from the draft itself. The draft is a shared fact — one
 * pick log that every viewer would have to agree on — while these are yours
 * alone. Keeping the split now means a future multi-device mode only has to
 * synchronise the engine, never this.
 */
export interface DraftPreferences {
  view: 'cards' | 'table';
  /** Player ids being tracked. */
  watchlist: string[];
  /** Player ids, in the order you intend to nominate them. */
  queue: string[];
  /** Seconds allowed per nomination; 0 turns the clock off. */
  clockSeconds: number;
}

const STORAGE_KEY = 'draft-vault:preferences:v1';

const DEFAULTS: DraftPreferences = {
  view: 'cards',
  watchlist: [],
  queue: [],
  clockSeconds: 30,
};

const read = (): DraftPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    // Merge rather than replace, so a preference added in a later version does
    // not come back undefined for someone with an older stored blob.
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DraftPreferences>) };
  } catch {
    return DEFAULTS;
  }
};

export const useDraftPreferences = () => {
  const [preferences, setPreferences] = useState<DraftPreferences>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      /* private mode or quota — preferences simply will not persist */
    }
  }, [preferences]);

  const setView = useCallback((view: DraftPreferences['view']) => {
    setPreferences((current) => ({ ...current, view }));
  }, []);

  const setClockSeconds = useCallback((clockSeconds: number) => {
    setPreferences((current) => ({ ...current, clockSeconds }));
  }, []);

  const toggleWatch = useCallback((playerId: string) => {
    setPreferences((current) => ({
      ...current,
      watchlist: current.watchlist.includes(playerId)
        ? current.watchlist.filter((id) => id !== playerId)
        : [...current.watchlist, playerId],
    }));
  }, []);

  const toggleQueue = useCallback((playerId: string) => {
    setPreferences((current) => ({
      ...current,
      queue: current.queue.includes(playerId)
        ? current.queue.filter((id) => id !== playerId)
        : [...current.queue, playerId],
    }));
  }, []);

  const removeFromQueue = useCallback((playerId: string) => {
    setPreferences((current) => ({
      ...current,
      queue: current.queue.filter((id) => id !== playerId),
    }));
  }, []);

  return {
    preferences,
    setView,
    setClockSeconds,
    toggleWatch,
    toggleQueue,
    removeFromQueue,
  };
};
