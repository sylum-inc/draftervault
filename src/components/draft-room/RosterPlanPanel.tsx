import { useMemo } from 'react';
import type { AuctionDraftService, Player } from '@/services/auctionDraftService';
import type { PlayerValue } from '@/lib/rosterPlan';

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
  /*
   * The whole auction pool, priced and ranked by what it adds to *this* roster.
   *
   * Split rather than filtered: a player the snake covers is not a mistake in
   * the list, he is the finding — more than a third of a commissioner's sheet
   * is players who add nothing you would not be handed for nothing, and knowing
   * which is most of the edge this format offers.
   */
  const { targets, covered } = useMemo(() => {
    const board = service.getBidBoard();
    const planned = new Set(plan.buy.map((entry) => entry.candidate.id));
    const rows = players
      .filter((entry) => !entry.isDrafted && entry.onSheet)
      .map((entry) => ({
        player: entry,
        value: board.get(entry.id),
        planned: planned.has(entry.id),
      }))
      .filter(
        (row): row is { player: Player; value: PlayerValue; planned: boolean } => !!row.value
      );
    return {
      targets: rows
        .filter((row) => row.value.maxPrice > 0)
        .sort((a, b) => b.value.gain - a.value.gain || b.value.maxPrice - a.value.maxPrice),
      covered: rows
        .filter((row) => row.value.maxPrice <= 0)
        .sort((a, b) => b.player.estimatedValue - a.player.estimatedValue)
        .map((row) => row.player),
    };
  }, [service, players, plan]);

  if (plan.reason) {
    return (
      <div className="dr-panel dr-plan-panel" aria-label="The plan">
        <header className="dr-bargains-head">
          <span className="dr-eyebrow">The plan</span>
        </header>
        <p className="dr-empty">{plan.reason}</p>
      </div>
    );
  }

  const budget = plan.spend + (plan.curve.length - 1 - plan.spend);

  return (
    <div className="dr-panel dr-plan-panel" aria-label="The plan">
      <header className="dr-bargains-head">
        <span className="dr-eyebrow">The plan</span>
        <span className="dr-footnote" style={{ margin: 0 }}>
          at tonight&rsquo;s prices
        </span>
      </header>

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
        <div title="The rate the whole board below is priced off. A player is worth bidding on while the points he adds per dollar beat it.">
          <dt>A dollar buys</dt>
          <dd>{plan.perDollar > 0 ? `${plan.perDollar} pts` : 'nothing more'}</dd>
        </div>
        <div title="Money the best lineup does not need. It is the floor under every price below, because an unspent auction dollar scores nothing.">
          <dt>Spare</dt>
          <dd style={plan.slack > 0 ? undefined : { color: 'var(--dr-ink-faint)' }}>
            ${plan.slack}
          </dd>
        </div>
      </dl>

      {/*
        Every player being auctioned, priced — not three names.

        A shopping list of the optimal basket is only actionable if the basket
        is guaranteed, and sixty players come up one at a time in an order
        nobody controls. What is needed at the table is a price for whoever has
        just been called, which is what the rate gives: the plan is the shape,
        this is the board you actually bid off.
      */}
      <ol className="dr-planlist">
        {targets.map(({ player, value, planned }) => (
          <li key={player.id}>
            <button
              type="button"
              className="dr-planlist-row"
              data-planned={planned ? '' : undefined}
              onClick={() => onSelect(player)}
              title={
                planned
                  ? `In the plan at $${value.maxPrice}. Worth ${value.gain} points over the man the snake hands you.`
                  : `Worth up to $${value.maxPrice} — ${value.gain} points over the free man, at ${plan.perDollar || '—'} points a dollar.`
              }
            >
              <span className="dr-pos">{player.position}</span>
              <span className="dr-planlist-name">{player.name}</span>
              {value.seat === 'flex' && <span className="dr-planlist-seat">flex</span>}
              <span className="dr-num dr-planlist-gain">+{value.gain}</span>
              <span
                className="dr-num dr-planlist-price"
                data-over={player.estimatedValue > value.maxPrice ? '' : undefined}
              >
                ${value.maxPrice}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {covered.length > 0 && (
        <>
          <p className="dr-eyebrow" style={{ marginTop: 10 }}>
            The snake covers these — {covered.length} of {targets.length + covered.length}
          </p>
          <p className="dr-covered">{covered.map((player) => player.name).join(' · ')}</p>
        </>
      )}

      <p className="dr-footnote">
        {plan.perDollar > 0
          ? `Every name is priced off the same line: ${plan.perDollar} points a dollar. The prices sum to far more than $${budget} on purpose — they are thresholds, not a shopping list, and you will win a handful of them.`
          : 'The money outlasts anything worth buying here, so every player who helps at all is worth your whole remaining budget. Holding it is the one guaranteed way to score nothing with it.'}
      </p>
    </div>
  );
};
