import type { Player } from '@/services/auctionDraftService';
import type { PlayerValue, RosterPlan } from '@/lib/rosterPlan';
import { getIdentity } from '@/services/nflIdentity';

/**
 * What the number in the bid box does, beside the bid box.
 *
 * Two readings used to live in the Tonight tab: how many points a dollar of
 * this bid buys against the plan's rate, and what the bid leaves you — money,
 * seats, and the best player the change could still reach. Both are about the
 * figure being typed rather than about the player, and the column the figure
 * is typed in was two thirds empty beneath the team chips while the tab had to
 * be scrolled to find them. A reading about a number belongs where the number
 * is, so it sits under SOLD and moves with every keystroke in the box.
 *
 * Nothing here is new arithmetic. The rate is the plan's dual, the change is
 * the engine's own `simulateSpend`, and the walk-away is the one the strip
 * already prints. It renders nothing until a bid is typed, because there is no
 * consequence to describe before there is a number.
 */
export interface BidConsequenceProps {
  /** The bid typed so far, parsed; NaN or 0 before a number is entered. */
  bid: number;
  walkAway: number | null;
  value: PlayerValue | null;
  plan: RosterPlan | null;
  /** What the bid leaves you, from the engine's own reserve rules. */
  spend: {
    remaining: number;
    slotsLeft: number;
    minimumHold: number;
    affordable: Player | null;
    legal: boolean;
  } | null;
}

const money = (value: number) => `$${Math.round(value)}`;

export const BidConsequence = ({ bid, walkAway, value, plan, spend }: BidConsequenceProps) => {
  const liveBid = Number.isFinite(bid) && bid >= 1 ? bid : null;
  if (liveBid == null) return null;

  const rate = plan && plan.perDollar > 0 ? plan.perDollar : null;
  const bidRate = value && value.gain > 0 ? value.gain / liveBid : null;
  const past = walkAway != null && liveBid > walkAway;
  const tone = past ? 'bad' : bidRate != null && rate != null && bidRate >= rate ? 'good' : 'muted';

  return (
    <section className="dr-stage-consequence" aria-label={`What a bid of ${money(liveBid)} does`}>
      <p className="dr-tonight-live" data-tone={tone}>
        At <b className="dr-num">{money(liveBid)}</b>
        {bidRate != null && rate != null ? (
          <>
            {' '}
            he buys <b className="dr-num">{bidRate.toFixed(2)}</b> pts a dollar against the
            plan&rsquo;s <b className="dr-num">{rate.toFixed(2)}</b>
            {past
              ? ` — past your walk-away of ${money(walkAway!)}.`
              : bidRate >= rate
                ? ' — better than the money does elsewhere.'
                : ' — the money buys more elsewhere on the sheet.'}
          </>
        ) : past ? (
          <> — past your walk-away of {money(walkAway!)}.</>
        ) : value && value.gain <= 0 ? (
          <> — he adds nothing your lineup would start.</>
        ) : (
          <> — no plan to measure it against.</>
        )}
      </p>

      {spend && (
        <>
          <dl className="dr-tonight-facts">
            <div>
              <dt>Left after</dt>
              <dd className="dr-num" data-tone={spend.legal ? undefined : 'bad'}>
                {money(spend.remaining)}
              </dd>
            </div>
            <div>
              <dt>Seats to buy</dt>
              <dd className="dr-num">{spend.slotsLeft}</dd>
            </div>
            {spend.minimumHold > 0 && (
              <div>
                <dt>Must hold</dt>
                <dd className="dr-num">{money(spend.minimumHold)}</dd>
              </div>
            )}
          </dl>
          <p className="dr-footnote">
            {!spend.legal
              ? 'Over what the rules let you spend.'
              : spend.affordable
                ? `The best player left the change could still buy is ${getIdentity(spend.affordable.id)?.name ?? spend.affordable.name} (${spend.affordable.position}, ${money(spend.affordable.estimatedValue)}).`
                : 'Nothing left on the board would fit in the change.'}
          </p>
        </>
      )}
    </section>
  );
};
