import {
  INFLATION_BOUNDS,
  type DraftPhase,
  type InflationBasis,
  type MarketState,
  type Team,
  type TierBreak,
} from '@/services/auctionDraftService';
import type { Endgame } from '@/lib/endgame';

interface MarketPanelProps {
  market: MarketState;
  teams: Team[];
  /**
   * When to buy, as opposed to what to buy.
   *
   * Here rather than in its own panel because it belongs beside inflation: both
   * are readings of the same thing — how much money is chasing how few players
   * — and splitting them would let the room read two answers to one question.
   * Inflation says what that does to a price; this says what it does to timing.
   */
  endgame: Endgame;
  /**
   * Which half of the draft is running.
   *
   * Every reading in here is about money, and in the snake half no money moves.
   * The engine freezes inflation at 1.00 so the meter cannot drift upward on
   * its own; this is what stops the panel from reporting that as a live
   * measurement of a market that has closed.
   */
  phase: DraftPhase;
  /**
   * What produced the inflation number.
   *
   * The meter used to print a multiplier with nothing behind it, and a number
   * nobody can interrogate is not an edge — it is the first thing to be talked
   * out of when the bidding gets loud. Money left, value left, how many players
   * that value is spread over, and whether the reading is clamped or frozen all
   * come from the engine as one object, so the explanation cannot describe a
   * different number from the one the board is pricing at.
   */
  basis: InflationBasis;
  /**
   * The shelf about to empty at each position, and the step down off it.
   *
   * Counts both halves of the draft: a tier is emptied by a snake pick exactly
   * as it is by a $40 one. The dollar step is list prices of players still on
   * the board rather than money anybody spent, which is why it survives into
   * the snake — but it is null wherever either side of the step is not being
   * auctioned, because a $1 floor price is not a price anybody would pay.
   */
  tierBreaks: TierBreak[];
}

/** Plain words for what the inflation number means for the next bid. */
const readInflation = (inflation: number): { label: string; tone: string } => {
  if (inflation >= 1.15)
    return { label: 'Money is chasing scraps — expect overpays', tone: 'var(--dr-danger)' };
  if (inflation >= 1.04) return { label: 'Prices running hot', tone: 'var(--dr-caution)' };
  if (inflation <= 0.85) return { label: 'Value on the board — bid', tone: 'var(--dr-value)' };
  if (inflation <= 0.96) return { label: 'Slightly in your favour', tone: 'var(--dr-value)' };
  return { label: 'Priced about right', tone: 'var(--dr-ink-muted)' };
};

/**
 * What the room is doing.
 *
 * Every reading comes off the live draft rather than a model: money unspent
 * against value unsold, what the room has actually paid against what we said
 * players were worth, how much of each position is gone, and what it costs to
 * keep waiting at one.
 */
export const MarketPanel = ({
  market,
  teams,
  phase,
  basis,
  tierBreaks,
  endgame,
}: MarketPanelProps) => {
  const snake = phase === 'snake';
  const reading = snake
    ? { label: 'The money is finished — the snake fills the rest', tone: 'var(--dr-ink-muted)' }
    : readInflation(market.inflation);
  const premiumPct = market.premium != null ? Math.round((market.premium - 1) * 100) : null;

  // Where the room is paying under our numbers — the only bargain signal that
  // is not circular, because it comes from what people actually bid rather than
  // from the same model that set the prices.
  const priced = market.scarcity
    .filter((row) => row.premium != null)
    .sort((a, b) => (a.premium ?? 1) - (b.premium ?? 1));

  const cliffs = [...market.scarcity]
    .filter((row) => row.cliff > 0 && row.total - row.gone > 0)
    .sort((a, b) => b.cliff - a.cliff)
    .slice(0, 3);

  const runsLow = market.scarcity.filter((row) => row.tierOneLeft > 0 && row.tierOneLeft <= 3);

  // Fewest left first: the shelf about to empty is the one worth a glance, and
  // a position with nine of its tier still on the board is not news.
  //
  // Filtered on the same conditions the alert uses, rather than each deciding
  // separately what counts. A tier that only ever held one player is not a shelf
  // about to empty — which is why the alert stays quiet — but the panel led with
  // a red "QB 1/1 · then −46 pts" on an untouched board, signalling a cliff one
  // pick away before anybody had bid. And a tier with nothing below it reported
  // a step of zero, which reads as "no drop here" rather than "no shelf below".
  const breaks = [...tierBreaks]
    .filter((row) => row.started >= 2 && row.pointStep != null)
    .sort((a, b) => a.left - b.left || (b.pointStep ?? 0) - (a.pointStep ?? 0));

  return (
    <section className="dr-panel dr-rail" aria-label="Market">
      <header className="dr-rail-head">
        <h2 className="dr-eyebrow">Market</h2>
        <span className="dr-eyebrow">{teams.length} teams</span>
      </header>

      <div className="dr-meter">
        <div className="dr-meter-head">
          <span className="dr-eyebrow">Inflation</span>
          <strong className="dr-num" style={{ color: reading.tone }}>
            {market.inflation.toFixed(2)}×
          </strong>
        </div>
        {/* The engine's own clamp, read rather than restated: a bar drawn to
            different ends from the ones the number is clamped to is a bar that
            lies about being pinned. */}
        <div className="dr-meter-track">
          <span
            className="dr-meter-fill"
            style={{
              width: `${Math.max(0, Math.min(100, ((market.inflation - INFLATION_BOUNDS.min) / (INFLATION_BOUNDS.max - INFLATION_BOUNDS.min)) * 100))}%`,
              background: reading.tone,
            }}
          />
          <span
            className="dr-meter-mark"
            style={{
              left: `${((1 - INFLATION_BOUNDS.min) / (INFLATION_BOUNDS.max - INFLATION_BOUNDS.min)) * 100}%`,
            }}
          />
        </div>
        <p className="dr-meter-note" style={{ color: reading.tone }}>
          {reading.label}
        </p>
        <p className="dr-meter-note">
          {snake ? (
            <>${market.moneyLeft} went unspent — nothing left to bid on</>
          ) : (
            <>
              ${market.moneyLeft} left chasing ${market.valueLeft} of value
            </>
          )}
          {premiumPct != null && (
            <>
              {snake ? ' · room paid ' : ' · room paying '}
              <strong className="dr-num">
                {premiumPct > 0 ? '+' : ''}
                {premiumPct}%
              </strong>
              {' vs our numbers'}
            </>
          )}
        </p>

        {/*
          What drove it.

          Inflation is one division, and every term of it is here: the money
          still in the room over the list value of everything still for sale.
          Printing the workings is the difference between a number somebody can
          act on and a number somebody argues with — and it is also the only way
          to see the two states in which it has stopped being a measurement at
          all: pinned against the clamp, and frozen through the snake.
        */}
        <dl className="dr-drivers">
          <div>
            <dt>Money left</dt>
            <dd className="dr-num">${basis.moneyLeft}</dd>
          </div>
          <div>
            <dt>Value left</dt>
            <dd className="dr-num">${basis.valueLeft}</dd>
          </div>
          <div>
            <dt>Still for sale</dt>
            <dd className="dr-num">
              {basis.forSaleLeft}
              <span style={{ color: 'var(--dr-ink-faint)' }}>/{basis.forSaleTotal}</span>
            </dd>
          </div>
        </dl>
        <p className="dr-footnote">
          {basis.frozen ? (
            <>
              Held at 1.00× for the snake: money left is fixed while value left keeps shrinking, so
              a live reading would climb on its own through a phase in which nobody spends.
            </>
          ) : basis.clamped ? (
            <>
              ${basis.moneyLeft} ÷ ${basis.valueLeft} is {basis.raw.toFixed(2)}×, pinned at the{' '}
              {basis.clamped === 'ceiling' ? INFLATION_BOUNDS.max : INFLATION_BOUNDS.min}× clamp.
            </>
          ) : (
            <>
              ${basis.moneyLeft} ÷ ${basis.valueLeft} of list value across {basis.forSaleLeft}{' '}
              players still being auctioned.
              {basis.openSlots > 0 && ` $${basis.openSlots} is held back by the reserve.`}
            </>
          )}
        </p>
      </div>

      <h3 className="dr-eyebrow" style={{ marginTop: 14 }}>
        Position supply
      </h3>
      {market.scarcity.map((row) => {
        const gone = row.total ? row.gone / row.total : 0;
        return (
          <div className="dr-supply" key={row.position}>
            <span className="dr-supply-pos">{row.position}</span>
            <span className="dr-meter-track dr-supply-track">
              <span
                className="dr-meter-fill"
                style={{
                  width: `${gone * 100}%`,
                  background:
                    gone > 0.75
                      ? 'var(--dr-danger)'
                      : gone > 0.5
                        ? 'var(--dr-caution)'
                        : 'var(--dr-value)',
                }}
              />
            </span>
            <span className="dr-num dr-supply-count">
              {row.total - row.gone}
              <span style={{ color: 'var(--dr-ink-faint)' }}>/{row.total}</span>
            </span>
          </div>
        );
      })}

      {runsLow.length > 0 && (
        <p className="dr-notice dr-notice-warn" style={{ marginTop: 10 }}>
          Tier one thinning:{' '}
          {runsLow
            .map((row) => `${row.tierOneLeft} ${row.position}${row.tierOneLeft === 1 ? '' : 's'}`)
            .join(', ')}{' '}
          left.
        </p>
      )}

      <h3 className="dr-eyebrow" style={{ marginTop: 14 }}>
        {snake ? 'What the room paid' : 'What the room is paying'}
      </h3>
      {priced.length === 0 ? (
        <p className="dr-meter-note">
          Two players at a position have to sell before there is a price to read.
        </p>
      ) : (
        <ul className="dr-premiums">
          {priced.map((row) => {
            const over = Math.round(((row.premium ?? 1) - 1) * 100);
            return (
              <li key={row.position}>
                <span className="dr-supply-pos">{row.position}</span>
                <span
                  className="dr-num"
                  style={{
                    color:
                      over > 8
                        ? 'var(--dr-danger)'
                        : over < -8
                          ? 'var(--dr-value)'
                          : 'var(--dr-ink-muted)',
                  }}
                >
                  {over > 0 ? '+' : ''}
                  {over}%
                </span>
                <span className="dr-premium-note">
                  {over > 8 ? 'going over list' : over < -8 ? 'going cheap' : 'at list'} ·{' '}
                  {row.sold} sold
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="dr-eyebrow" style={{ marginTop: 14 }}>
        Next tier break
      </h3>
      {/* The shelf currently being drafted out of at each position, and the step
          down off it. Counts both halves — a tier is emptied by a free pick
          exactly as it is by a $40 one — while the dollar step is list prices of
          players still on the board, so it is absent wherever either side of the
          step is not being auctioned at all. */}
      <ul className="dr-premiums">
        {breaks.map((row) => (
          <li key={row.position}>
            <span className="dr-supply-pos">{row.position}</span>
            <span
              className="dr-num"
              style={{ color: row.left <= 2 ? 'var(--dr-danger)' : 'var(--dr-ink-muted)' }}
            >
              {row.left}
              <span style={{ color: 'var(--dr-ink-faint)' }}>/{row.started}</span>
            </span>
            <span className="dr-premium-note">
              tier {row.tier} · then −{row.pointStep} pts
              {row.dollarStep != null && row.dollarStep > 0 && ` and −$${row.dollarStep}`}
            </span>
          </li>
        ))}
      </ul>

      {/* When to buy. Sits with inflation because both read the same thing —
          how much money is chasing how few players — and the room should not be
          able to find two answers to one question in two places. Hidden in the
          snake, where no money moves and a par price would be arithmetic about
          nothing. */}
      {!snake && (
        <>
          <h3 className="dr-eyebrow" style={{ marginTop: 14 }}>
            When to buy
          </h3>
          <p
            className="dr-endgame-verdict"
            data-lean={endgame.lean}
            style={{
              borderLeftColor:
                endgame.lean === 'buy'
                  ? 'var(--dr-value)'
                  : endgame.lean === 'wait'
                    ? 'var(--dr-caution)'
                    : 'var(--dr-line-strong)',
            }}
          >
            {endgame.verdict}
          </p>
          <dl className="dr-league-summary">
            <div>
              <dt>Par from here</dt>
              <dd className="dr-num">${endgame.par}</dd>
            </div>
            <div>
              <dt>Room is paying</dt>
              <dd
                className="dr-num"
                style={{
                  color:
                    endgame.pace == null
                      ? undefined
                      : endgame.pace > endgame.par
                        ? 'var(--dr-caution)'
                        : 'var(--dr-value)',
                }}
              >
                {endgame.pace == null ? '—' : `$${endgame.pace}`}
              </dd>
            </div>
            <div>
              <dt>Can still pay par</dt>
              <dd className="dr-num">
                {endgame.liveBidders}/{endgame.teamCount}
              </dd>
            </div>
            {endgame.yourShare != null && (
              <div>
                <dt>Your share of the money</dt>
                <dd className="dr-num" style={{ color: 'var(--dr-value)' }}>
                  {Math.round(endgame.yourShare * 100)}%
                </dd>
              </div>
            )}
          </dl>
        </>
      )}

      <h3 className="dr-eyebrow" style={{ marginTop: 14 }}>
        Cost of waiting
      </h3>
      <ul className="dr-premiums">
        {cliffs.map((row) => (
          <li key={row.position}>
            <span className="dr-supply-pos">{row.position}</span>
            <span className="dr-num" style={{ color: 'var(--dr-caution)' }}>
              −{row.cliff}
            </span>
            <span className="dr-premium-note">points from the best left to the fifth</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
