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
  /** Player ids pinned into the comparison tray. Two to four is the useful range. */
  pinned: string[];
  /** Whether the opinion layer is showing. Off until asked for. */
  advisor: boolean;
  /** Which column set the dense board is showing. */
  columns: 'value' | 'production' | 'usage' | 'market';
}

const STORAGE_KEY = 'draft-vault:preferences:v1';

const MAX_PINNED = 4;

const DEFAULTS: DraftPreferences = {
  view: 'cards',
  watchlist: [],
  queue: [],
  clockSeconds: 30,
  pinned: [],
  /*
   * On, which is a reversal worth stating because the opposite was deliberate.
   *
   * Facts and opinions being different files is the rule, and nothing about
   * that rule lives in this line. What carries it is `draftAdvisor.ts` being
   * its own module, the panel being its own dashed box, the badge reading
   * "Advisor", the caveat reading "opinion, for Team 1", and the aria-label
   * reading "opinions, not measurements". A default of `false` protected none
   * of it; it only meant the one panel that answers "what do I do now" — which
   * name to put on the block, which to keep off it, and who can still afford
   * the man you want — was behind a button nobody had pressed.
   *
   * The dismiss control stays where it is. An opinion you cannot turn off is
   * the thing the separation exists to prevent, and that is a control, not a
   * default.
   */
  advisor: true,
  columns: 'value',
};

/**
 * That the advisor's default has already been flipped in this browser.
 *
 * Its own key, for the reason `LEAGUE_CONFIRMED_KEY` and `MARKET_BOARD_KEY`
 * have theirs: it answers a different question from the value beside it.
 * Preferences are merged over the defaults and written back on mount, so
 * anybody who has ever opened the app is carrying an explicit `advisor: false`
 * — and that false is the *old default echoed back*, not a choice. Without
 * this the flip would reach nobody who already has the app open, which is the
 * only person it was for.
 *
 * It applies once. Turning the advisor off after that is a choice, the key is
 * already set, and it sticks.
 */
const ADVISOR_DEFAULT_KEY = 'draft-vault:advisor-default:v2';

const read = (): DraftPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Merge rather than replace, so a preference added in a later version does
    // not come back undefined for someone with an older stored blob.
    const merged = raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DraftPreferences>) }
      : { ...DEFAULTS };
    if (localStorage.getItem(ADVISOR_DEFAULT_KEY) == null) {
      // Idempotent on purpose: this runs from a lazy initializer, so React's
      // double-invoke in strict mode takes the second pass down the else.
      localStorage.setItem(ADVISOR_DEFAULT_KEY, 'applied');
      merged.advisor = DEFAULTS.advisor;
    }
    return merged;
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

  const togglePin = useCallback((playerId: string) => {
    setPreferences((current) => {
      if (current.pinned.includes(playerId)) {
        return { ...current, pinned: current.pinned.filter((id) => id !== playerId) };
      }
      // Past four columns the comparison stops being readable on any screen, so
      // the oldest pin drops out rather than the new one being refused.
      const pinned = [...current.pinned, playerId].slice(-MAX_PINNED);
      return { ...current, pinned };
    });
  }, []);

  const clearPins = useCallback(() => {
    setPreferences((current) => ({ ...current, pinned: [] }));
  }, []);

  const setAdvisor = useCallback((advisor: boolean) => {
    setPreferences((current) => ({ ...current, advisor }));
  }, []);

  const setColumns = useCallback((columns: DraftPreferences['columns']) => {
    setPreferences((current) => ({ ...current, columns }));
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
    togglePin,
    clearPins,
    setAdvisor,
    setColumns,
  };
};
