import { useMemo, useState } from 'react';
import type { AuctionDraftService, Player, Team } from '@/services/auctionDraftService';
import { getIdentity } from '@/services/nflIdentity';

interface BudgetPlannerProps {
  service: AuctionDraftService;
  team: Team | undefined;
  player: Player | null;
  /** What is typed into the bid box, so the two stay in step. */
  bid: string;
  players: Player[];
}

/**
 * What this bid does to everything after it.
 *
 * The price is the least interesting number at an auction. The one that decides
 * it is what the roster looks like once the money is gone — a $60 running back
 * is a bargain on a full budget and a disaster with nine slots still open. This
 * runs that arithmetic live against the engine's own reserve rules, so the
 * answer is the same one `validateBid` would give.
 */
export const BudgetPlanner = ({ service, team, player, bid, players }: BudgetPlannerProps) => {
  const [override, setOverride] = useState<number | null>(null);
  const typed = Number.parseInt(bid, 10);
  const amount = override ?? (Number.isFinite(typed) ? typed : (player?.estimatedValue ?? 0));

  const simulation = useMemo(
    () => (team ? service.simulateSpend(team.id, amount) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [service, team, amount, players]
  );

  if (!team) {
    return <p className="dr-empty dr-panel">Pick a team to plan its budget.</p>;
  }

  const filled = Object.values(team.roster).reduce((a, b) => a + b, 0);
  const steps = [0.5, 0.75, 1, 1.25, 1.5];

  return (
    <div className="dr-planner dr-panel">
      <header className="dr-planner-head">
        <span className="dr-eyebrow">
          {amount >= 1 ? `If ${team.name} spends` : `${team.name}'s budget`}
        </span>
        <span className="dr-planner-amount dr-num">
          {amount >= 1 ? `$${amount}` : `$${team.remaining}`}
        </span>
      </header>

      {player && (
        <div className="dr-planner-steps" role="group" aria-label="Try a different price">
          {steps.map((step) => {
            const value = Math.max(1, Math.round((player.estimatedValue || 1) * step));
            return (
              <button
                key={step}
                type="button"
                className="dr-chip"
                aria-pressed={amount === value}
                onClick={() => setOverride(value === override ? null : value)}
              >
                ${value}
              </button>
            );
          })}
          <button type="button" className="dr-chip" onClick={() => setOverride(null)}>
            reset
          </button>
        </div>
      )}

      {simulation && (
        <>
          <dl className="dr-planner-grid">
            <div>
              <dt>Left after</dt>
              <dd
                className="dr-num"
                style={{
                  color:
                    simulation.remaining < simulation.minimumHold
                      ? 'var(--dr-danger)'
                      : 'var(--dr-value)',
                }}
              >
                ${simulation.remaining}
              </dd>
            </div>
            <div>
              <dt>Slots to fill</dt>
              <dd className="dr-num">{simulation.slotsLeft}</dd>
            </div>
            <div>
              <dt>Per slot</dt>
              <dd className="dr-num">${simulation.perSlot.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Must reserve</dt>
              <dd className="dr-num">${simulation.minimumHold}</dd>
            </div>
          </dl>

          {/* The reserve is not advice; it is the rule the engine enforces. */}
          <div className="dr-planner-bar" aria-hidden="true">
            <span
              className="dr-planner-spent"
              style={{ width: `${Math.min(100, (amount / Math.max(1, team.remaining)) * 100)}%` }}
            />
            <span
              className="dr-planner-reserve"
              style={{
                width: `${Math.min(100, (simulation.minimumHold / Math.max(1, team.remaining)) * 100)}%`,
              }}
            />
          </div>

          <p className="dr-planner-note">
            {amount < 1 ? (
              <>Type a bid, or pick one of the prices above, to see what it leaves behind.</>
            ) : simulation.remaining < simulation.minimumHold ? (
              <strong style={{ color: 'var(--dr-danger)' }}>
                Over budget once the ${simulation.minimumHold} reserve for open starting slots is
                held back.
              </strong>
            ) : simulation.affordable ? (
              <>
                The best player still on the board that $
                {Math.max(0, simulation.remaining - simulation.minimumHold)} could buy afterwards is{' '}
                <strong>
                  {getIdentity(simulation.affordable.id)?.name ?? simulation.affordable.name}
                </strong>{' '}
                <span className="dr-num">
                  ({simulation.affordable.position}, ${simulation.affordable.estimatedValue})
                </span>
                .
              </>
            ) : (
              <>Nothing left on the board would fit in the change.</>
            )}
          </p>

          <p className="dr-footnote">
            {filled} of 16 slots filled. The reserve is a dollar for every starting slot still open,
            which is the same rule the bid check applies.
          </p>
        </>
      )}
    </div>
  );
};
