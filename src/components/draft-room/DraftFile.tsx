import { useEffect, useRef, useState } from 'react';
import { saveTextFile } from '@/lib/saveFile';
import type { AuctionDraftService } from '@/services/auctionDraftService';

interface DraftFileProps {
  service: AuctionDraftService;
  /** Picks currently on the board, so a load can say what it would replace. */
  draftedCount: number;
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
export const DraftFile = ({ service, draftedCount, onLoaded, onClose }: DraftFileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<{ text: string; name: string } | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setProblem(null);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const outcome = await saveTextFile(
      `draft-vault-${stamp}.json`,
      service.exportDraft(),
      'application/json'
    );
    if (outcome.status === 'saved') setMessage(`Saved ${outcome.filename}.`);
    else if (outcome.status === 'failed') setProblem('Could not save the file.');
  };

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

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            onClick={() => void save()}
            disabled={draftedCount === 0}
          >
            Save {draftedCount} pick{draftedCount === 1 ? '' : 's'}
          </button>
          <button type="button" className="dr-button" onClick={() => fileRef.current?.click()}>
            Load a draft…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
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

        <div className="dr-results-actions">
          <button ref={closeRef} type="button" className="dr-button" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
};
