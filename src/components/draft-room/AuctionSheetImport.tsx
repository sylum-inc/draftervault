import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AUCTION_SHEET_EXAMPLE,
  readAuctionSheet,
  sheetPlayerIds,
  type ParsedSheet,
} from '@/lib/auctionSheet';
import type { Candidate } from '@/lib/rankingsCsv';
import type { Player } from '@/services/auctionDraftService';

interface AuctionSheetImportProps {
  players: Player[];
  /** How many players the sheet in force names. Zero when there is none. */
  activeCount: number;
  /** Sheet players the room passed over, so the panel can say so. */
  unsoldCount: number;
  /**
   * The shortest list the engine will accept.
   *
   * Below it the whole budget chases too few players and the best of them
   * prices above a whole budget — a headline number no team could legally bid.
   * A short sheet is reached by accident far more often than on purpose: a
   * surname-first export or a defence block written in nicknames resolves a
   * fraction of its names, and sixty quietly becomes eighteen.
   */
  maxPrice: number;
  /** What a list would do to prices, before it is applied. */
  preview: (ids: string[]) => {
    top: number;
    median: number;
    bought: number;
    movers: Array<{ id: string; name: string; from: number; to: number }>;
  };
  onApply: (ids: string[]) => void;
  onClear: () => void;
  onClose: () => void;
}

const asCandidates = (players: Player[]): Candidate[] =>
  players.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
  }));

/**
 * Reading in the sheet the commissioner actually circulated.
 *
 * Until this exists the engine knows only how many players are auctioned and
 * assumes they are our own best fifty — they are not, and every price on the
 * board is computed from that assumption. So the panel shows what it understood
 * before it changes anything: the failure that costs a draft is not a rejected
 * paste, it is a list that applies cleanly against the wrong players, or one
 * that quietly drops two names off the end of a Slack message.
 *
 * A name that fits two players is never bound. It is offered with its
 * candidates, because the person holding the sheet knows which Robinson is on
 * it and this file does not.
 */
export const AuctionSheetImport = ({
  players,
  activeCount,
  unsoldCount,
  maxPrice,
  preview,
  onApply,
  onClear,
  onClose,
}: AuctionSheetImportProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  /** An ambiguous row answered by hand, keyed by the line it was on. */
  const [bindings, setBindings] = useState<Record<number, string>>({});

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const candidates = useMemo(() => asCandidates(players), [players]);
  const parsed: ParsedSheet | null = useMemo(
    () => (text.trim() ? readAuctionSheet(text, candidates) : null),
    [text, candidates]
  );

  const matched = parsed?.resolutions.filter((r) => r.status === 'matched') ?? [];
  const ambiguous = parsed?.resolutions.filter((r) => r.status === 'ambiguous') ?? [];
  const unmatched = parsed?.resolutions.filter((r) => r.status === 'unmatched') ?? [];

  const ids = useMemo(
    () => (parsed ? sheetPlayerIds(parsed.resolutions, bindings) : []),
    [parsed, bindings]
  );
  const prices = useMemo(() => (ids.length ? preview(ids) : null), [ids, preview]);
  const tooShort = prices !== null && prices.top > maxPrice;
  const lost = ambiguous.length + unmatched.length + (parsed?.skipped.length ?? 0);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setSource(file.name);
    setBindings({});
    setText(await file.text());
  };

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Import the auction sheet">
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close auction sheet import"
        onClick={onClose}
      />

      <article className="dr-modal-panel dr-import">
        <header className="dr-results-head">
          <div>
            <h2 className="dr-stage-name" style={{ fontSize: 26 }}>
              The auction sheet
            </h2>
            <p className="dr-meter-note">
              Paste the commissioner’s list — an email, a Slack message, a column out of a
              spreadsheet. Only these players are bought with money; everybody else is filled in by
              the snake, so the same budget chases far fewer players and every one of them costs
              more. The draft in progress is untouched: a sheet changes prices, not rules.
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

        <section className="dr-modal-section">
          <div className="dr-import-actions">
            <button type="button" className="dr-button" onClick={() => fileRef.current?.click()}>
              Choose a file…
            </button>
            {activeCount > 0 && (
              <button type="button" className="dr-button" onClick={onClear}>
                Remove the sheet ({activeCount})
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
              hidden
              onChange={(event) => {
                void readFile(event.target.files?.[0]);
                // Let the same file be chosen twice in a row after an edit.
                event.target.value = '';
              }}
            />
          </div>

          {activeCount > 0 && (
            <p className="dr-meter-note">
              {activeCount} player{activeCount === 1 ? '' : 's'} on the sheet in force
              {unsoldCount > 0 && `, ${unsoldCount} of them marked unsold after the room passed`}.
              Applying a new list replaces it.
            </p>
          )}

          <label className="dr-import-paste">
            <span className="dr-eyebrow">Paste the sheet</span>
            <textarea
              className="dr-input dr-import-textarea"
              rows={8}
              spellCheck={false}
              placeholder={AUCTION_SHEET_EXAMPLE}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setBindings({});
                setSource(event.target.value.trim() ? 'pasted' : '');
              }}
            />
          </label>
          <p className="dr-meter-note">
            One name a line, a numbered list, bullets, tab-separated columns, or names run together
            with commas. A position and a club beside a name are used to tell two players of the
            same name apart; a price or a bye week is read off and thrown away — a sheet says who is
            auctioned, not what they are worth.
          </p>
        </section>

        {parsed && (
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">What this sheet says {source && `· ${source}`}</h3>
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
                <dt>Duplicates</dt>
                <dd>{parsed.duplicates.length}</dd>
              </div>
              <div>
                <dt>On the sheet</dt>
                <dd>{ids.length}</dd>
              </div>
            </dl>

            {ambiguous.length > 0 && (
              <>
                <p className="dr-meter-note">
                  These names fit more than one player, so nothing is guessed — “B. Robinson” is
                  Bijan or Brian, and binding the wrong one puts a bench back on the sheet and a $54
                  player off it. Say which, or add a club to the line.
                </p>
                <ul className="dr-import-rows">
                  {ambiguous.map((row) => (
                    <li key={row.row.line}>
                      <span className="dr-import-line">line {row.row.line}</span>
                      <strong>{row.row.name}</strong>
                      {row.status === 'ambiguous' && (
                        <select
                          className="dr-input"
                          aria-label={`Which ${row.row.name}`}
                          value={bindings[row.row.line] ?? ''}
                          onChange={(event) =>
                            setBindings((current) => {
                              const next = { ...current };
                              if (event.target.value) next[row.row.line] = event.target.value;
                              else delete next[row.row.line];
                              return next;
                            })
                          }
                        >
                          <option value="">leave off the sheet</option>
                          {row.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name} ({option.position} {option.team})
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {unmatched.length > 0 && (
              <ul className="dr-import-rows">
                {unmatched.slice(0, 6).map((row) => (
                  <li key={`${row.row.line}-${row.row.name}`}>
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

            {parsed.duplicates.length > 0 && (
              <p className="dr-meter-note">
                {parsed.duplicates.length} repeated name
                {parsed.duplicates.length === 1 ? '' : 's'} ignored (
                {parsed.duplicates
                  .slice(0, 3)
                  .map((row) => row.name)
                  .join(', ')}
                ).
              </p>
            )}

            {parsed.skipped.length > 0 && (
              <section className="dr-modal-section">
                {/* Named, not counted. Every other way a name can be lost lists
                    the row; a bare "1 line skipped" cannot be checked against
                    the sheet in your hand, which is exactly when you need to
                    check it — a heading rule that ate a real player would read
                    identically to one that ate a heading. */}
                <h3 className="dr-eyebrow">
                  Skipped {parsed.skipped.length} line{parsed.skipped.length === 1 ? '' : 's'}
                </h3>
                <ul className="dr-import-rows">
                  {parsed.skipped.slice(0, 8).map((row) => (
                    <li key={`${row.line}-${row.text}`}>
                      <span className="dr-import-line">line {row.line}</span>
                      <span className="dr-import-name">{row.text}</span>
                      <span className="dr-meter-note">{row.reason}</span>
                    </li>
                  ))}
                  {parsed.skipped.length > 8 && (
                    <li className="dr-meter-note">and {parsed.skipped.length - 8} more</li>
                  )}
                </ul>
              </section>
            )}

            {prices && (
              <>
                <h3 className="dr-eyebrow" style={{ marginTop: 12 }}>
                  What this does to prices
                </h3>
                <dl className="dr-league-summary">
                  <div>
                    <dt>Best player costs</dt>
                    <dd style={{ color: 'var(--dr-value)' }}>${prices.top}</dd>
                  </div>
                  <div>
                    <dt>Typical price</dt>
                    <dd>${prices.median}</dd>
                  </div>
                  <div>
                    <dt>Players bought</dt>
                    <dd>{prices.bought}</dd>
                  </div>
                </dl>
                {prices.movers.length > 0 && (
                  <ul className="dr-import-rows">
                    {prices.movers.map((mover) => (
                      <li key={mover.id}>
                        <strong>{mover.name}</strong>
                        <span className="dr-meter-note">
                          ${mover.from} → ${mover.to}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        {tooShort && (
          <p className="dr-league-warning">
            This list of {ids.length} would price its best player at ${prices?.top}, and no team
            holds more than ${maxPrice} to spend on one. The whole budget chases whatever is on the
            sheet, so too few names — or one star among bench players — puts a number on the board
            that nobody could legally bid. This is almost always the paste rather than the sheet:
            check the {lost} row{lost === 1 ? '' : 's'} listed above before applying.
          </p>
        )}
        {!tooShort && lost > 0 && ids.length > 0 && (
          <p className="dr-meter-note">
            {lost} row{lost === 1 ? '' : 's'} did not make it onto the sheet. Every one is listed
            above — a name that fits two players is never bound to a guess.
          </p>
        )}

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            disabled={ids.length === 0 || tooShort}
            onClick={() => onApply(ids)}
          >
            {ids.length === 0
              ? 'Nothing to auction'
              : tooShort
                ? `Too concentrated to auction — $${prices?.top} tops a $${maxPrice} ceiling`
                : `Auction these ${ids.length} player${ids.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="dr-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </article>
    </div>
  );
};
