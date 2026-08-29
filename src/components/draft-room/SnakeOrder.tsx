import { useEffect, useRef, useState } from 'react';
import type { Team } from '@/services/auctionDraftService';

interface SnakeOrderProps {
  /** The order in force, first pick first. */
  order: Team[];
  myTeamId: string | null;
  /** Snake picks already made, so a reorder can say what it does and does not move. */
  pickCount: number;
  onApply: (teamIds: string[]) => void;
  onClose: () => void;
}

/**
 * The order the snake is called in.
 *
 * The commissioner fixes it in advance — it is not drawn here and it is not
 * derived from what anybody spent at auction, because in this league those are
 * two unrelated facts and inferring one from the other would put the wrong name
 * on the clock in front of a room that can see the sheet.
 *
 * It deliberately does not live in `LeagueSettings`: that panel's Apply clears
 * the draft, because every price it can change was bid against. A reorder
 * changes no price and invalidates no pick — only who is next — so throwing an
 * afternoon away over it would be the same mistake team names were moved out of
 * `LeagueShape` to avoid.
 *
 * Reordering mid-draft is allowed on purpose. The order gets announced at the
 * table, and it gets announced differently often enough that the alternative is
 * running the rest of the night off a list everyone present can see is wrong.
 */
export const SnakeOrder = ({ order, myTeamId, pickCount, onApply, onClose }: SnakeOrderProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<Team[]>(order);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  const changed = draft.some((team, index) => team.id !== order[index]?.id);

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Snake draft order">
      <button type="button" className="dr-modal-scrim" aria-label="Close" onClick={onClose} />

      <article className="dr-modal-panel dr-confirm">
        <h2 className="dr-stage-name" style={{ fontSize: 22 }}>
          Snake order
        </h2>
        <p className="dr-meter-note">
          Round one runs down this list and round two runs back up it. The commissioner sets it;
          this is only where it gets written down.
          {pickCount > 0 &&
            ` ${pickCount} snake pick${pickCount === 1 ? ' has' : 's have'} already been made — reordering moves who is next, and changes nothing already taken.`}
        </p>

        <ol className="dr-order-list">
          {draft.map((team, index) => (
            <li key={team.id} className={team.id === myTeamId ? 'is-mine' : undefined}>
              <span className="dr-num" style={{ color: 'var(--dr-ink-faint)' }}>
                {index + 1}
              </span>
              <span className="dr-order-name">
                {team.name}
                {team.id === myTeamId && (
                  <span className="dr-mine-tag" title="Your team">
                    you
                  </span>
                )}
              </span>
              <button
                type="button"
                className="dr-step"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${team.name} earlier`}
              >
                ↑
              </button>
              <button
                type="button"
                className="dr-step"
                onClick={() => move(index, 1)}
                disabled={index === draft.length - 1}
                aria-label={`Move ${team.name} later`}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            disabled={!changed}
            onClick={() => onApply(draft.map((team) => team.id))}
          >
            Use this order
          </button>
          <button type="button" className="dr-button" onClick={() => setDraft(order)}>
            Reset
          </button>
          <button ref={closeRef} type="button" className="dr-button" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
};
