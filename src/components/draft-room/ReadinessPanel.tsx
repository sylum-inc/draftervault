import type { ReadinessCheck } from '@/lib/readiness';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';

interface ReadinessPanelProps {
  checks: ReadinessCheck[];
  onClose: () => void;
}

const ORDER: Record<ReadinessCheck['level'], number> = { blocking: 0, warn: 1, ready: 2 };

const WORD: Record<ReadinessCheck['level'], string> = {
  blocking: 'Fix this',
  warn: 'Worth doing',
  ready: 'Done',
};

/**
 * Is this board actually set up?
 *
 * The one question worth asking before the first name is called, and until now
 * the only way to answer it was to open six panels and remember what each of
 * them said. The individual warnings all existed — the settings panel refuses a
 * first run, the import panel bands a lossy paste, the market panel dates the
 * ADP — and every one of them is seen only by somebody who happens to be
 * looking at it.
 *
 * Sorted worst first, and the things that are fine are listed too: a checklist
 * that only shows problems can tell you there is something wrong but never that
 * there is nothing.
 */
export const ReadinessPanel = ({ checks, onClose }: ReadinessPanelProps) => {
  useDismissOnEscape(onClose);
  const sorted = [...checks].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  const outstanding = sorted.filter((check) => check.level !== 'ready').length;

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Draft readiness">
      <button type="button" className="dr-modal-scrim" aria-label="Close" onClick={onClose} />
      <article className="dr-modal-panel dr-ready-panel">
        <header className="dr-bargains-head">
          <span className="dr-eyebrow">Before the first name is called</span>
          <button type="button" className="dr-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <p className="dr-verdict-line">
          {outstanding === 0
            ? 'Everything this app can check is set. What is left is the drafting.'
            : `${outstanding} thing${outstanding === 1 ? '' : 's'} would change what the board says. Each one is silent — the numbers look exactly as authoritative either way.`}
        </p>

        <ul className="dr-checklist">
          {sorted.map((check) => (
            <li key={check.id} data-level={check.level}>
              <span className="dr-checklist-mark" aria-hidden="true">
                {check.level === 'ready' ? '✓' : check.level === 'warn' ? '!' : '✕'}
              </span>
              <span className="dr-checklist-body">
                <b>
                  {check.label}
                  <em>{WORD[check.level]}</em>
                </b>
                <span>{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="dr-footnote">
          Nothing here is advice about a player. It is whether the numbers on the board were
          computed from the league you are actually in, the sheet actually being auctioned, and a
          roster that is actually yours.
        </p>
      </article>
    </div>
  );
};
