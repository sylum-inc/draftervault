import { useEffect, useRef, useState } from 'react';
import type { AuctionDraftService } from '@/services/auctionDraftService';

interface DraftFileProps {
  service: AuctionDraftService;
  /** Picks currently on the board, so a load can say what it would replace. */
  draftedCount: number;
  /** Picks made since the draft last left this browser. */
  unsaved: number;
  /** What the last save or copy did, worded by the room that performed it. */
  note: { tone: 'ok' | 'bad'; text: string } | null;
  /**
   * Handing the draft over happens in the room rather than here.
   *
   * Both acts are also on the keyboard, and both have to mark the record as
   * having left — a second copy of that here would be a second answer to "has
   * this draft been backed up", and the two would drift on the one night it
   * matters.
   */
  onSave: () => void;
  onCopy: () => void;
  onLoaded: () => void;
  onClose: () => void;
}

/**
 * The draft, as a file.
 *
 * Everything else in this app keeps the draft in one browser profile on one
 * machine. That is fine until draft night, when the machine running the
 * auction is a single point of failure and the room has nowhere to go if it
 * dies. A file is the escape hatch: save one between rounds, and any other
 * machine can pick the auction up mid-flight.
 */
export const DraftFile = ({
  service,
  draftedCount,
  unsaved,
  note,
  onSave,
  onCopy,
  onLoaded,
  onClose,
}: DraftFileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<{ text: string; name: string } | null>(null);
  /**
   * The way back in for a draft that left on the clipboard.
   *
   * Copying is offered its own keystroke and is the fallback when a file cannot
   * be produced at all — so without somewhere to paste it back, the escape
   * hatch was a one-way door, and the promise that a draft in a note can be
   * picked up again was not true of any code here.
   */
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const load = (text: string) => {
    const result = service.importDraft(text);
    if (!result.ok) {
      setProblem(result.reason);
      setPending(null);
      return;
    }
    setProblem(null);
    setPending(null);
    setMessage(
      `Loaded ${result.restored} pick${result.restored === 1 ? '' : 's'}` +
        (result.skipped ? `, ${result.skipped} could not be replayed.` : '.')
    );
    onLoaded();
  };

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Draft file">
      <button type="button" className="dr-modal-scrim" aria-label="Close" onClick={onClose} />

      <article className="dr-modal-panel dr-confirm">
        <h2 className="dr-stage-name" style={{ fontSize: 22 }}>
          Draft file
        </h2>
        <p className="dr-meter-note">
          The draft lives in this browser on this machine. Save a copy and any other machine can
          pick the auction up from where it stands.
        </p>

        {/* The number the top bar is showing, said in words. A copy on the
            clipboard is as good as a file here: it is the same text, and it
            loads back through the same door. */}
        {draftedCount > 0 && (
          <p className={unsaved ? 'dr-league-warning' : 'dr-meter-note'}>
            {unsaved === 0
              ? 'Every pick on the board is in the last copy you took.'
              : `${unsaved} pick${unsaved === 1 ? '' : 's'} have happened since the draft last left this browser.`}
          </p>
        )}

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            onClick={onSave}
            disabled={draftedCount === 0}
          >
            Save {draftedCount} pick{draftedCount === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            className="dr-button"
            onClick={onCopy}
            disabled={draftedCount === 0}
            title="The same text a file carries — paste it into a note, a message or an email"
          >
            Copy to clipboard
          </button>
          <button type="button" className="dr-button" onClick={() => fileRef.current?.click()}>
            Load a draft…
          </button>
          <button type="button" className="dr-button" onClick={() => setPasting((open) => !open)}>
            {pasting ? 'Cancel paste' : 'Paste a draft…'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              const text = await file.text();
              // Replacing a draft in progress is exactly the mistake this panel
              // exists to prevent, so it is never done without being asked.
              if (draftedCount > 0) setPending({ text, name: file.name });
              else load(text);
            }}
          />
        </div>

        {pasting && (
          <>
            <label className="dr-field">
              <span className="dr-eyebrow">Paste the draft</span>
              <textarea
                className="dr-import-textarea"
                rows={5}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                placeholder="Paste the text a copy put on your clipboard, or the contents of a saved file."
                aria-label="Paste a saved draft"
              />
            </label>
            <div className="dr-results-actions">
              <button
                type="button"
                className="dr-button"
                disabled={!pasted.trim()}
                onClick={() => {
                  const text = pasted.trim();
                  // Replacing a draft in progress asks first, exactly as a file
                  // does — the same door, so the same guard.
                  if (draftedCount > 0) setPending({ text, name: 'the pasted draft' });
                  else load(text);
                }}
              >
                Load what is pasted
              </button>
            </div>
          </>
        )}

        {pending && (
          <>
            <p className="dr-league-warning">
              Loading {pending.name} replaces the {draftedCount} pick
              {draftedCount === 1 ? '' : 's'} on the board now. Save a copy first if you might want
              them back.
            </p>
            <div className="dr-results-actions">
              <button type="button" className="dr-button" onClick={() => load(pending.text)}>
                Replace the draft
              </button>
              <button type="button" className="dr-button" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </>
        )}

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
        {note && (
          <p
            className="dr-meter-note"
            role="status"
            style={{ color: note.tone === 'bad' ? 'var(--dr-danger)' : 'var(--dr-value)' }}
          >
            {note.text}
          </p>
        )}

        <div className="dr-results-actions">
          <button ref={closeRef} type="button" className="dr-button" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
};
