import { useMemo } from 'react';
import type { AuctionDraftService, Player } from '@/services/auctionDraftService';

interface RosterPlanPanelProps {
  service: AuctionDraftService;
  /** Only here to re-solve when the board moves. */
  players: Player[];
  onSelect: (player: Player) => void;
}

/**
 * The shape of your hundred dollars.
 *
 * Every other panel in this room answers a local question — what is this player
 * worth, what is the room paying, what does this bid gain over the man the
 * snake hands you free. This is the one that answers the question those are all
 * fragments of: *given the money and this sheet, which players should I
 * actually end up with?*
 *
 * It matters most in a format where eleven or twelve seats are filled for
 * nothing. Half a commissioner's sheet consists of players the snake very
 * nearly matches, and an auction spends its money on them anyway because every
 * name called sounds like a player worth owning. The plan is what makes walking
 * away legible: three names and a total, against a board of sixty.
 *
 * The number under it is the one to carry into every bid — what the marginal
 * dollar buys. A player beating that rate is worth taking money off the plan
 * for; one below it is not, whatever his price says.
 */
export const RosterPlanPanel = ({ service, players, onSelect }: RosterPlanPanelProps) => {
  const plan = useMemo(
    () => service.getRosterPlan(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, players]
  );
  const byId = useMemo(() => new Map(players.map((entry) => [entry.id, entry])), [players]);

  if (plan.reason) {
    return (
      <div className="dr-panel" aria-label="The plan">
        <header className="dr-bargains-head">
          <span className="dr-eyebrow">The plan</span>
        </header>
        <p className="dr-empty">{plan.reason}</p>
      </div>
    );
  }

  const budget = plan.spend + (plan.curve.length - 1 - plan.spend);

  return (
    <div className="dr-panel" aria-label="The plan">
      <header className="dr-bargains-head">
        <span className="dr-eyebrow">The plan</span>
        <span className="dr-footnote" style={{ margin: 0 }}>
          at tonight&rsquo;s prices
        </span>
      </header>

      {plan.buy.length === 0 ? (
        <p className="dr-empty">
          Nothing on the sheet beats what the snake hands you for nothing. That is a real answer in
          this format, not a missing one — keep the money.
        </p>
      ) : (
        <>
          <dl className="dr-facts">
            <div>
              <dt>Spend</dt>
              <dd>
                ${plan.spend}
                <span className="dr-facts-note"> of ${budget}</span>
              </dd>
            </div>
            <div title="Points this plan adds over filling every seat from the snake">
              <dt>Buys you</dt>
              <dd style={{ color: 'var(--dr-good)' }}>+{plan.gain} pts</dd>
            </div>
            <div title="What the last dollar of this budget is buying. A bid beating this rate is worth taking money off the plan for; one below it is not.">
              <dt>A dollar buys</dt>
              <dd>{plan.perDollar > 0 ? `${plan.perDollar} pts` : 'nothing more'}</dd>
            </div>
            {/* The money the best lineup has no use for. It is the floor under
                every walk-away on the board, because a dollar left unspent at
                the end of an auction scores nothing — so anyone you can roster
                is worth at least this much, however little he adds. */}
            <div title="Money the best lineup does not need. It is what any player you can roster is worth, however little he adds — an unspent auction dollar scores nothing.">
              <dt>Spare</dt>
              <dd style={plan.slack > 0 ? undefined : { color: 'var(--dr-ink-faint)' }}>
                ${plan.slack}
              </dd>
            </div>
          </dl>

          <ul className="dr-planlist">
            {plan.buy.map((entry) => {
              const player = byId.get(entry.candidate.id);
              return (
                <li key={entry.candidate.id}>
                  <button
                    type="button"
                    className="dr-planlist-row"
                    disabled={!player}
                    onClick={() => player && onSelect(player)}
                    title={player ? `Put ${player.name} on the block` : undefined}
                  >
                    <span className="dr-pos">{entry.candidate.position}</span>
                    <span className="dr-planlist-name">{entry.candidate.name}</span>
                    {entry.seat === 'flex' && <span className="dr-planlist-seat">flex</span>}
                    <span className="dr-num dr-planlist-gain">+{entry.gain}</span>
                    <span className="dr-num dr-planlist-price">${entry.candidate.price}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {plan.slack === 0 && plan.buy.length > 0 && (
        <p className="dr-footnote" style={{ marginTop: 6 }}>
          Every dollar is committed, so anyone off this list is worth nothing{' '}
          <em>while the plan holds</em> — and worth bidding on the moment one of these goes to
          somebody else. The board re-solves on every sale, so the numbers move with it.
        </p>
      )}

      <p className="dr-footnote">
        {plan.perDollar > 0
          ? `The best set the money can still buy, and what the last dollar of it is worth. Anything on the sheet gaining more than ${plan.perDollar} points a dollar is worth breaking the plan for; anything gaining less is money the snake would have saved you.`
          : 'The money outlasts anything worth buying here — every seat past this plan is one the snake fills as well as the auction would. Bid up on what is left rather than saving it.'}
      </p>
    </div>
  );
};
