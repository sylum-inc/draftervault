import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuctionDraftService } from '@/services/auctionDraftService';
import type { DraftServerHook } from '@/hooks/use-draft-server';
import {
  cancelJob,
  createDraft,
  deleteDraft,
  getDraft,
  getVersion,
  isServedAddress,
  listDrafts,
  listJobs,
  readJob,
  renameDraft,
  sameOriginAddress,
  serverConfig,
  setServerConfig,
  startJob,
  type ServerResult,
} from '@/services/draftServer';
import {
  JOB_POLL_MS,
  type DraftDetail,
  type DraftSummary,
  type JobRecord,
} from '@/lib/serverContract';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';

interface ServerPanelProps {
  service: AuctionDraftService;
  server: DraftServerHook;
  /** Picks on the board now, so a load can say what it would replace. */
  draftedCount: number;
  onLoaded: () => void;
  onClose: () => void;
}

const ago = (at: number | null): string => {
  if (!at) return 'never';
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 90) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
};

const stamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

/**
 * The server, as a screen somebody can look at.
 *
 * Everything here is an extra. The panel is written so that the honest answer
 * to "is there a server?" is the first thing on it and "no" is a perfectly good
 * one — because that is the state the app ships in, the state the published
 * artifact is permanently in, and the state draft night falls back to. It says
 * that in words rather than showing a broken connection indicator, which is the
 * same thing rendered as a fault.
 *
 * Loading a saved draft goes through `service.importDraft`, the identical door
 * a file from a USB stick comes through. The server is a filing cabinet: it
 * stores the bytes `exportDraft()` produced and has no opinion about whether
 * they describe a legal draft. The engine decides that, once, in one place, and
 * counts the picks that no longer replay rather than dropping them quietly.
 */
export const ServerPanel = ({
  service,
  server,
  draftedCount,
  onLoaded,
  onClose,
}: ServerPanelProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { discovery, checking, binding, backup, recheck, bind, saveNow } = server;
  const ready = discovery.state === 'ready';

  const [address, setAddress] = useState(() => serverConfig()?.url ?? sameOriginAddress());
  const [token, setToken] = useState(() => serverConfig()?.token ?? '');
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [log, setLog] = useState<{ id: string; from: number; lines: string[] } | null>(null);
  /** Where the server said its last answer started, so the cursor cannot drift. */
  const cursorRef = useRef(0);
  const [newName, setNewName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; version: number; label: string } | null>(
    null
  );

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useDismissOnEscape(onClose);

  /** Report a failure once, in the panel, and never in the console. */
  const report = useCallback(<T,>(result: ServerResult<T>): T | null => {
    if (result.ok) {
      setProblem(null);
      return result.value;
    }
    setProblem(result.message);
    return null;
  }, []);

  const refreshDrafts = useCallback(async () => {
    if (!ready) return;
    const found = report(await listDrafts());
    if (found) setDrafts(found);
  }, [ready, report]);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  useEffect(() => {
    if (!ready) return;
    void listJobs().then((result) => {
      if (result.ok) setJobs(result.value);
    });
  }, [ready]);

  /**
   * Follow a running job by asking it how it is getting on.
   *
   * A poll rather than a stream, for the reasons set out in `server/jobs.mjs`.
   * `from` is where the last answer ended, so each request carries back only
   * the lines that are new — a twenty-minute build does not re-send its whole
   * log every second and a half.
   */
  const logId = log?.id ?? null;
  useEffect(() => {
    if (!ready || !logId) return;

    const pull = () => {
      // The cursor is whatever the server says it gave us, not what we asked
      // for. A job that outruns the 500-line ring has its `from` clamped
      // forward, so tracking our own count fell behind and re-appended lines we
      // already held.
      void readJob(logId, cursorRef.current).then((result) => {
        if (!result.ok) return;
        cursorRef.current = result.value.from + result.value.lines.length;
        setJobs((current) =>
          current.map((job) => (job.id === result.value.job.id ? result.value.job : job))
        );
        setLog((current) =>
          current && current.id === result.value.job.id
            ? {
                ...current,
                from: result.value.from,
                lines: [...current.lines, ...result.value.lines],
              }
            : current
        );
      });
    };

    // Once whatever the state, then on a timer only while it is running. The
    // poll used to be the only caller, and it returned early unless the job was
    // running — so clicking "log" on the twenty-minute rebuild you walked away
    // from showed "waiting for output…" forever, while the server held every
    // line of it.
    pull();
    const running = jobs.find((job) => job.id === logId)?.state === 'running';
    if (!running) return;
    const timer = setInterval(pull, JOB_POLL_MS);
    return () => clearInterval(timer);
    // `jobs` is deliberately absent: it changes on every poll, and depending on
    // it tore the interval down and rebuilt it each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, logId]);

  const connect = () => {
    setProblem(null);
    setMessage(null);
    setServerConfig({ url: address, token });
    recheck();
  };

  const disconnect = () => {
    // An empty url is the stored "off", not a cleared override — clearing it
    // let discovery find the served address again on the very next check.
    setServerConfig({ url: '', token: '' });
    bind(null);
    setDrafts([]);
    setDetail(null);
    setMessage('Disconnected. Nothing about the draft changed.');
    recheck();
  };

  const startBackup = async () => {
    const name = newName.trim() || `Draft ${new Date().toLocaleDateString()}`;
    const created = report(await createDraft(name, service.exportDraft(), 'started backing up'));
    if (!created) return;
    bind({ id: created.id, name: created.name }, created.versions);
    setNewName('');
    setMessage(`Backing up to "${created.name}". Every pick from here is saved as a version.`);
    void refreshDrafts();
  };

  const load = async (id: string, version: number) => {
    const stored = report(await getVersion(id, version));
    if (!stored) return;
    const result = service.importDraft(stored.payload);
    if (!result.ok) {
      // The engine refused it. That is the engine's judgement about a draft,
      // not a server failure, and it is worded as the engine worded it.
      setProblem(result.reason);
      return;
    }
    setPending(null);
    setMessage(
      `Loaded ${result.restored} pick${result.restored === 1 ? '' : 's'}` +
        (result.skipped ? `, ${result.skipped} could not be replayed.` : '.')
    );
    onLoaded();
  };

  const openDraft = async (id: string) => {
    const found = report(await getDraft(id));
    if (found) setDetail(found);
  };

  const run = async (kind: 'pool' | 'research') => {
    const started = report(await startJob(kind, {}));
    if (!started) return;
    setJobs((current) => [started.job, ...current.filter((job) => job.id !== started.job.id)]);
    cursorRef.current = 0;
    setLog({ id: started.job.id, from: 0, lines: [] });
    setMessage(null);
  };

  const health = discovery.state === 'ready' ? discovery.health : null;

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Server">
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close server panel"
        onClick={onClose}
      />

      <article className="dr-modal-panel dr-import dr-server">
        <header className="dr-results-head">
          <div>
            <h2 className="dr-stage-name" style={{ fontSize: 26 }}>
              Server
            </h2>
            <p className="dr-meter-note">
              An extra, never a dependency. Saved drafts with a version history, and the two batch
              rebuilds started from here instead of a terminal. With it switched off the app is
              exactly what it is now.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {/* ---- connection ---------------------------------------------- */}

        <section className="dr-modal-section">
          <p className="dr-eyebrow">Connection</p>

          {discovery.state === 'off' && (
            <p className="dr-meter-note">
              No server configured, which is the ordinary state. Point this at one if you have it
              running; the draft, the pool and every price work the same either way.
            </p>
          )}
          {checking && <p className="dr-meter-note">Asking…</p>}
          {discovery.state === 'unreachable' && (
            <p className="dr-meter-note" style={{ color: 'var(--dr-danger)' }}>
              {discovery.message}
            </p>
          )}
          {discovery.state === 'incompatible' && (
            <p className="dr-meter-note" style={{ color: 'var(--dr-danger)' }}>
              {discovery.message}
            </p>
          )}
          {health && (
            <dl className="dr-league-summary">
              <div>
                <dt>Server</dt>
                <dd style={{ fontSize: 14 }}>{health.name}</dd>
              </div>
              <div>
                <dt>Auth</dt>
                <dd style={{ fontSize: 14 }}>{health.requiresToken ? 'token' : 'none'}</dd>
              </div>
              <div>
                <dt>Pool rebuild</dt>
                <dd style={{ fontSize: 14 }}>{health.jobs.pool ? 'yes' : 'no'}</dd>
              </div>
              <div>
                <dt>Research</dt>
                <dd style={{ fontSize: 14 }}>{health.jobs.research ? 'yes' : 'no key'}</dd>
              </div>
            </dl>
          )}

          <div className="dr-league-grid">
            <label className="dr-league-field">
              <span className="dr-eyebrow">Address</span>
              <input
                className="dr-input"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={sameOriginAddress()}
                spellCheck={false}
              />
            </label>
            <label className="dr-league-field">
              <span className="dr-eyebrow">Shared token</span>
              <input
                className="dr-input"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="only if the server asks for one"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          </div>
          <p className="dr-meter-note">
            The token is kept in this browser and sent as a header. It is never part of the build —
            anything compiled into the bundle is readable by anyone who opens it.
            {isServedAddress() &&
              ' This page was served by a server, which is where the address came from.'}
          </p>

          <div className="dr-import-actions" style={{ marginTop: 10 }}>
            <button type="button" className="dr-button dr-button-primary" onClick={connect}>
              {ready ? 'Reconnect' : 'Connect'}
            </button>
            <button type="button" className="dr-button" onClick={recheck} disabled={checking}>
              Check again
            </button>
            {discovery.state !== 'off' && (
              <button type="button" className="dr-button" onClick={disconnect}>
                Disconnect
              </button>
            )}
          </div>
        </section>

        {/* ---- backup -------------------------------------------------- */}

        {ready && (
          <section className="dr-modal-section">
            <p className="dr-eyebrow">Backing up this draft</p>
            {binding ? (
              <>
                <p className="dr-meter-note">
                  Saving to <strong>{binding.name}</strong> — {backup.versions || 0} version
                  {backup.versions === 1 ? '' : 's'}, last {ago(backup.at)}.
                  {backup.state === 'stopped' && ' Stopped after repeated failures.'}
                </p>
                {backup.message && (
                  <p className="dr-meter-note" style={{ color: 'var(--dr-danger)' }}>
                    {backup.message}
                  </p>
                )}
                <div className="dr-import-actions">
                  <button type="button" className="dr-button" onClick={saveNow}>
                    Save a version now
                  </button>
                  <button type="button" className="dr-button" onClick={() => bind(null)}>
                    Stop backing up
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="dr-meter-note">
                  Nothing is being backed up. Start one and every pick from here writes a new
                  version a couple of seconds after it lands.
                </p>
                <div className="dr-import-actions">
                  <input
                    className="dr-input"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Name this draft"
                    style={{ flex: '1 1 200px' }}
                  />
                  <button
                    type="button"
                    className="dr-button dr-button-primary"
                    onClick={() => void startBackup()}
                  >
                    Back up {draftedCount} pick{draftedCount === 1 ? '' : 's'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ---- saved drafts -------------------------------------------- */}

        {ready && (
          <section className="dr-modal-section">
            <p className="dr-eyebrow">Saved drafts ({drafts.length})</p>
            {drafts.length === 0 && (
              <p className="dr-meter-note">Nothing saved on this server yet.</p>
            )}
            <ul className="dr-import-rows">
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <strong>{draft.name}</strong>
                  <span className="dr-meter-note">
                    {draft.versions} version{draft.versions === 1 ? '' : 's'} · updated{' '}
                    {stamp(draft.updatedAt)}
                    {binding?.id === draft.id ? ' · backing up here' : ''}
                  </span>
                  <button
                    type="button"
                    className="dr-linkish"
                    onClick={() => void openDraft(draft.id)}
                  >
                    versions
                  </button>
                  <button
                    type="button"
                    className="dr-linkish"
                    onClick={() => {
                      const name = window.prompt('Rename this draft', draft.name);
                      if (name) void renameDraft(draft.id, name).then(() => void refreshDrafts());
                    }}
                  >
                    rename
                  </button>
                  <button
                    type="button"
                    className="dr-linkish"
                    onClick={() => {
                      if (!window.confirm(`Delete "${draft.name}" and all its versions?`)) return;
                      void deleteDraft(draft.id).then(() => {
                        if (binding?.id === draft.id) bind(null);
                        setDetail((current) => (current?.id === draft.id ? null : current));
                        void refreshDrafts();
                      });
                    }}
                  >
                    delete
                  </button>
                </li>
              ))}
            </ul>

            {detail && (
              <>
                <p className="dr-eyebrow" style={{ marginTop: 14 }}>
                  {detail.name} — versions
                </p>
                <ul className="dr-import-rows">
                  {detail.history.map((version) => (
                    <li key={version.version}>
                      <span className="dr-import-line">v{version.version}</span>
                      <span className="dr-meter-note">
                        {stamp(version.savedAt)} · {Math.round(version.bytes / 1024)} kB ·{' '}
                        {version.note}
                      </span>
                      <button
                        type="button"
                        className="dr-linkish"
                        onClick={() => {
                          const target = {
                            id: detail.id,
                            version: version.version,
                            label: `${detail.name} v${version.version}`,
                          };
                          // Replacing a draft in progress is exactly the mistake
                          // this asks about, the same way the file panel does.
                          if (draftedCount > 0) setPending(target);
                          else void load(target.id, target.version);
                        }}
                      >
                        load
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {pending && (
              <>
                <p className="dr-league-warning">
                  Loading {pending.label} replaces the {draftedCount} pick
                  {draftedCount === 1 ? '' : 's'} on the board now.
                </p>
                <div className="dr-import-actions">
                  <button
                    type="button"
                    className="dr-button"
                    onClick={() => void load(pending.id, pending.version)}
                  >
                    Replace the draft
                  </button>
                  <button type="button" className="dr-button" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ---- rebuilds ------------------------------------------------ */}

        {ready && (
          <section className="dr-modal-section">
            <p className="dr-eyebrow">Rebuilds</p>
            <p className="dr-meter-note">
              These run the same scripts a terminal would, on the server's machine. They write to a
              staging directory rather than over the live data: a fresh pool changes every price on
              the board, and a draft in progress was bid at the old ones. Moving the result in is a
              deliberate act between drafts, followed by a rebuild of the app.
            </p>
            <div className="dr-import-actions">
              <button
                type="button"
                className="dr-button"
                disabled={!health?.jobs.pool}
                onClick={() => void run('pool')}
              >
                Rebuild the player pool
              </button>
              <button
                type="button"
                className="dr-button"
                disabled={!health?.jobs.research}
                onClick={() => void run('research')}
                title={health?.jobs.research ? undefined : 'The server has no OpenRouter key'}
              >
                Research the pool
              </button>
            </div>

            <ul className="dr-import-rows">
              {jobs.map((job) => (
                <li key={job.id}>
                  <span className="dr-import-line">{job.kind}</span>
                  <span className="dr-meter-note">
                    {job.state} · started {stamp(job.startedAt)}
                    {job.exitCode !== null ? ` · exit ${job.exitCode}` : ''}
                  </span>
                  <button
                    type="button"
                    className="dr-linkish"
                    onClick={() => {
                      cursorRef.current = 0;
                      setLog({ id: job.id, from: 0, lines: [] });
                    }}
                  >
                    log
                  </button>
                  {job.state === 'running' && (
                    <button
                      type="button"
                      className="dr-linkish"
                      onClick={() => void cancelJob(job.id)}
                    >
                      stop
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {log && (
              <>
                <pre className="dr-server-log">
                  {log.lines.length ? log.lines.join('\n') : 'waiting for output…'}
                </pre>
                <p className="dr-meter-note">
                  Output goes to{' '}
                  <code>
                    {jobs.find((job) => job.id === log.id)?.outDir ?? 'the staging directory'}
                  </code>
                </p>
              </>
            )}
          </section>
        )}

        {(problem || message) && (
          <section className="dr-modal-section">
            {problem && (
              <p className="dr-meter-note" role="status" style={{ color: 'var(--dr-danger)' }}>
                {problem}
              </p>
            )}
            {message && !problem && (
              <p className="dr-meter-note" role="status" style={{ color: 'var(--dr-value)' }}>
                {message}
              </p>
            )}
          </section>
        )}

        <div className="dr-results-actions">
          <button type="button" className="dr-button" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
};
