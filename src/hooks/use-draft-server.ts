import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuctionDraftService } from '@/services/auctionDraftService';
import {
  describeServer,
  isConfigured,
  saveVersion,
  serverBinding,
  setServerBinding,
  type Discovery,
  type ServerBinding,
} from '@/services/draftServer';

/**
 * The room's one connection to the optional server.
 *
 * Two jobs, and both of them are shaped by having to be invisible when there is
 * no server: find out whether one is there, and back the draft up to it as it
 * is played.
 *
 * With nothing configured this hook does not subscribe to anything, does not
 * set a timer and never calls `fetch`. It is not that the effects run and take
 * an early return — the effects have nothing to do, so there is no interval
 * ticking under a draft and nothing to go wrong on the night. That is the
 * property the tests assert.
 */

/**
 * How long the draft has to sit still before a backup is written.
 *
 * The engine announces a change on every pick, and a run of nominations in a
 * hot auction can land three in five seconds. Waiting a moment coalesces those
 * into one save, and the cost of the delay is bounded by what it protects
 * against: the laptop dying between a pick and two seconds later, which loses
 * one pick out of a log that is also still in localStorage.
 */
const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * How many failures in a row before the backup stops trying.
 *
 * A tunnel that has dropped will not come back because a fourth pick was made,
 * and a request per pick for the rest of the night is a request per pick that
 * can time out, log, and take attention at the worst moment. So it gives up and
 * says so, and the panel has a button to start again.
 */
const GIVE_UP_AFTER = 3;

export type BackupState = 'off' | 'idle' | 'saving' | 'saved' | 'failed' | 'stopped';

export interface BackupStatus {
  state: BackupState;
  /** When the last version landed, as epoch ms. */
  at: number | null;
  /** How many versions the bound draft has, as the server last reported. */
  versions: number;
  message: string | null;
}

export interface DraftServerHook {
  discovery: Discovery;
  checking: boolean;
  binding: ServerBinding | null;
  backup: BackupStatus;
  /** Re-run the handshake — after connecting, or after giving up. */
  recheck: () => void;
  /**
   * Start or stop backing the draft up to a stored draft on the server.
   *
   * `versions` is what the server just said the draft has, so the panel does
   * not read "0 versions" beside a draft it created a version of a moment ago.
   */
  bind: (binding: ServerBinding | null, versions?: number) => void;
  /** Write a version now rather than waiting for the debounce. */
  saveNow: () => void;
}

export const useDraftServer = (service: AuctionDraftService): DraftServerHook => {
  // `isConfigured` reads localStorage and nothing else, so the first render
  // already knows whether there is anything to look for. With no address the
  // state is `off` and stays `off` without a single request.
  const [discovery, setDiscovery] = useState<Discovery>({ state: 'off' });
  const [checking, setChecking] = useState(false);
  const [binding, setBinding] = useState<ServerBinding | null>(() => serverBinding());
  const [backup, setBackup] = useState<BackupStatus>({
    state: 'off',
    at: null,
    versions: 0,
    message: null,
  });
  const [attempt, setAttempt] = useState(0);

  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  const bind = useCallback((next: ServerBinding | null, versions = 0) => {
    setServerBinding(next);
    setBinding(next);
    setBackup({
      state: next ? 'idle' : 'off',
      at: next ? Date.now() : null,
      versions: next ? versions : 0,
      message: null,
    });
  }, []);

  /** The handshake. Runs on mount and whenever something asks for it again. */
  useEffect(() => {
    if (!isConfigured()) {
      setDiscovery({ state: 'off' });
      return;
    }
    let live = true;
    setChecking(true);
    void describeServer().then((result) => {
      if (!live) return;
      setDiscovery(result);
      setChecking(false);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  // ------------------------------------------------------------------------
  // autosave
  // ------------------------------------------------------------------------

  const ready = discovery.state === 'ready';
  const draftId = binding?.id ?? null;

  /**
   * Everything the save loop mutates without wanting a re-render.
   *
   * A timer, a save in flight, a change that arrived while one was in flight,
   * and a run of failures. None of it belongs in state: React re-rendering
   * because a request is halfway through is a re-render of the whole board
   * during an auction, for nothing anybody can see.
   */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const failures = useRef(0);

  const write = useCallback(async () => {
    if (!draftId) return;
    if (inFlight.current) {
      // A pick landed while the last save was in the air. Remembering it here
      // rather than starting a second request keeps saves in order, which
      // matters because the version history is what somebody scrolls back
      // through — out-of-order versions would read as the draft going backwards.
      dirty.current = true;
      return;
    }
    inFlight.current = true;
    setBackup((current) => ({ ...current, state: 'saving' }));
    const result = await saveVersion(draftId, service.exportDraft(), 'autosave');
    inFlight.current = false;

    if (result.ok) {
      failures.current = 0;
      setBackup({
        state: 'saved',
        at: Date.now(),
        versions: result.value.versions,
        message: null,
      });
    } else {
      failures.current += 1;
      const done = failures.current >= GIVE_UP_AFTER;
      setBackup((current) => ({
        ...current,
        state: done ? 'stopped' : 'failed',
        message: done
          ? `${result.message} Backup has stopped; the draft is safe in this browser.`
          : result.message,
      }));
    }

    if (dirty.current && failures.current < GIVE_UP_AFTER) {
      dirty.current = false;
      void write();
    }
  }, [draftId, service]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    failures.current = 0;
    void write();
  }, [write]);

  useEffect(() => {
    // No server, or nothing bound: nothing is subscribed, so a pick costs
    // exactly what it cost before this file existed.
    if (!ready || !draftId) return;

    failures.current = 0;
    setBackup((current) => (current.state === 'off' ? { ...current, state: 'idle' } : current));

    // `addChangeListener` rather than `setChangeListener`: the second-window
    // sync is already on that Set, and taking its slot would leave the
    // television showing a draft that stopped moving.
    const unsubscribe = service.addChangeListener(() => {
      if (failures.current >= GIVE_UP_AFTER) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void write();
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [ready, draftId, service, write]);

  return { discovery, checking, binding, backup, recheck, bind, saveNow };
};
