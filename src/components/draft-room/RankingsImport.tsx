import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RANKINGS_TEMPLATE,
  parseAndResolve,
  toOverrides,
  type Candidate,
  type ParsedRankings,
  type RankingOverride,
} from '@/lib/rankingsCsv';
import type { Player } from '@/services/auctionDraftService';

interface RankingsImportProps {
  players: Player[];
  /** How many players the current import already speaks for. */
  activeCount: number;
  onImport: (overrides: Record<string, RankingOverride>) => void;
  onClear: () => void;
  onClose: () => void;
  /**
   * Re-price at the consensus already in the pool, returning what it covered.
   *
   * Here rather than in league settings because this is the panel about whose
   * numbers drive the board, and a built-in consensus is the same claim a
   * pasted CSV makes from a source that needs no pasting.
   */
  onUseConsensus: () => { ranked: number; of: number };
}

const asCandidates = (players: Player[]): Candidate[] =>
  players.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
  }));

/**
 * Bringing your own rankings in.
 *
 * The pool's own numbers are a model's opinion; this is where somebody
 * substitutes theirs. It shows exactly what it understood before changing
 * anything, because the failure mode that matters is not a rejected file — it
 * is a file that imports cleanly against the wrong players.
 */
export const RankingsImport = ({
  players,
  activeCount,
  onImport,
  onClear,
  onClose,
  onUseConsensus,
}: RankingsImportProps) => {
  const [consensus, setConsensus] = useState<{ ranked: number; of: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const candidates = useMemo(() => asCandidates(players), [players]);
  const parsed: ParsedRankings | null = useMemo(
    () => (text.trim() ? parseAndResolve(text, candidates) : null),
    [text, candidates]
  );

  const matched = parsed?.resolutions.filter((r) => r.status === 'matched') ?? [];
  const ambiguous = parsed?.resolutions.filter((r) => r.status === 'ambiguous') ?? [];
  const unmatched = parsed?.resolutions.filter((r) => r.status === 'unmatched') ?? [];
  const overrides = useMemo(() => (parsed ? toOverrides(parsed.resolutions) : {}), [parsed]);
  const changes = Object.keys(overrides).length;

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setSource(file.name);
    setText(await file.text());
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(RANKINGS_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused; the template is on screen to select by hand.
      setCopied(false);
    }
  };

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Import rankings">
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close rankings import"
        onClick={onClose}
      />

      <article className="dr-modal-panel dr-import">
        <header className="dr-results-head">
          <div>
            <h2 className="dr-stage-name" style={{ fontSize: 26 }}>
              Import rankings
            </h2>
            <p className="dr-meter-note">
              Your values replace ours on the board and in every recommendation. Ours stay visible
              underneath, so you can always see which number is whose.
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

        {/* The measured recommendation, above the file picker because it is
            the one somebody should reach for first. `npm run backtest` swept
            blends of our ordering against real pre-season ADP over three
            held-out seasons, and the best weight on our own ordering was zero
            every time, including under leave-one-season-out. This is that
            board, and it needs no file. */}
        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Recommended · the market&rsquo;s order, our dollars</h3>
          <p className="dr-meter-note">
            Measured over three held-out seasons, expert consensus sorted players better than our
            model in 11 of 12 position-seasons, and every blend of the two scored between them
            rather than above. This re-prices the board at the consensus already bundled with it —
            their ordering, our dollar curve, position by position. Nothing to paste.
          </p>
          <div className="dr-import-actions">
            <button
              type="button"
              className="dr-button is-primary"
              onClick={() => {
                const coverage = onUseConsensus();
                setConsensus(coverage);
              }}
            >
              Use consensus
            </button>
            {consensus && (
              <span className="dr-meter-note" style={{ margin: 0, alignSelf: 'center' }}>
                Repriced {consensus.ranked} of {consensus.of}. The rest keep our number — consensus
                does not rank the dollar tail.
              </span>
            )}
          </div>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Or bring your own</h3>
          <div className="dr-import-actions">
            <button type="button" className="dr-button" onClick={() => fileRef.current?.click()}>
              Choose CSV…
            </button>
            <button type="button" className="dr-button" onClick={copyTemplate}>
              {copied ? 'Copied' : 'Copy template'}
            </button>
            {activeCount > 0 && (
              <button type="button" className="dr-button" onClick={onClear}>
                Remove current ({activeCount})
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              onChange={(event) => {
                void readFile(event.target.files?.[0]);
                // Let the same file be chosen twice in a row after an edit.
                event.target.value = '';
              }}
            />
          </div>

          <label className="dr-import-paste">
            <span className="dr-eyebrow">Or paste rows</span>
            <textarea
              className="dr-input dr-import-textarea"
              rows={6}
              spellCheck={false}
              placeholder={RANKINGS_TEMPLATE}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSource(event.target.value.trim() ? 'pasted' : '');
              }}
            />
          </label>
          <p className="dr-meter-note">
            Name is the only required column. Any of Rank, Value, Tier and Notes may follow, in any
            order, with or without a header row.
          </p>
        </section>

        {parsed && (
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">What this file says {source && `· ${source}`}</h3>
            <dl className="dr-league-summary">
              <div>
                <dt>Matched</dt>
                <dd style={{ color: 'var(--dr-value)' }}>{matched.length}</dd>
              </div>
              <div>
                <dt>Ambiguous</dt>
                <dd style={{ color: ambiguous.length ? 'var(--dr-danger)' : undefined }}>
                  {ambiguous.length}
                </dd>
              </div>
              <div>
                <dt>Not in pool</dt>
                <dd>{unmatched.length}</dd>
              </div>
              <div>
                <dt>Players changed</dt>
                <dd>{changes}</dd>
              </div>
            </dl>

            {ambiguous.length > 0 && (
              <>
                <p className="dr-meter-note">
                  These names fit more than one player, so nothing is guessed. Add a position
                  column, or use the full name, and import again.
                </p>
                <ul className="dr-import-rows">
                  {ambiguous.slice(0, 8).map((row) => (
                    <li key={row.row.line}>
                      <span className="dr-import-line">line {row.row.line}</span>
                      <strong>{row.row.name}</strong>
                      <span className="dr-meter-note">
                        {row.status === 'ambiguous' &&
                          row.options
                            .slice(0, 4)
                            .map((option) => `${option.name} (${option.position} ${option.team})`)
                            .join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {unmatched.length > 0 && (
              <ul className="dr-import-rows">
                {unmatched.slice(0, 6).map((row) => (
                  <li key={row.row.line}>
                    <span className="dr-import-line">line {row.row.line}</span>
                    <strong>{row.row.name}</strong>
                    <span className="dr-meter-note">no player of this name in the pool</span>
                  </li>
                ))}
                {unmatched.length > 6 && (
                  <li className="dr-meter-note">and {unmatched.length - 6} more</li>
                )}
              </ul>
            )}

            {parsed.skipped.length > 0 && (
              <p className="dr-meter-note">
                {parsed.skipped.length} row{parsed.skipped.length === 1 ? '' : 's'} skipped (
                {parsed.skipped[0].reason}).
              </p>
            )}

            {matched.length > 0 && (
              <>
                <h3 className="dr-eyebrow" style={{ marginTop: 12 }}>
                  First few changes
                </h3>
                <ul className="dr-import-rows">
                  {matched.slice(0, 6).map((row) => {
                    if (row.status !== 'matched') return null;
                    const override = overrides[row.player.id];
                    const player = players.find((p) => p.id === row.player.id);
                    return (
                      <li key={row.row.line}>
                        <span className="dr-import-line">line {row.row.line}</span>
                        <strong>{row.player.name}</strong>
                        <span className="dr-meter-note">
                          {override?.value !== undefined && player
                            ? `$${player.modelValue} → $${override.value}`
                            : 'rank and tier only'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        )}

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            disabled={changes === 0}
            onClick={() => onImport(overrides)}
          >
            {changes === 0
              ? 'Nothing to import'
              : `Apply to ${changes} player${changes === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="dr-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </article>
    </div>
  );
};
