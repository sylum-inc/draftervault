import type { DraftPhase, MarketState, Team } from '@/services/auctionDraftService';

interface MarketPanelProps {
  market: MarketState;
  teams: Team[];
  /**
   * Which half of the draft is running.
   *
   * Every reading in here is about money, and in the snake half no money moves.
   * The engine freezes inflation at 1.00 so the meter cannot drift upward on
   * its own; this is what stops the panel from reporting that as a live
   * measurement of a market that has closed.
   */
  phase: DraftPhase;
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
export const MarketPanel = ({ market, teams, phase }: MarketPanelProps) => {
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
        {/* 0.6 to 1.8 is the range the engine clamps to, so the bar is honest about its ends. */}
        <div className="dr-meter-track">
          <span
            className="dr-meter-fill"
            style={{
              width: `${Math.max(0, Math.min(100, ((market.inflation - 0.6) / 1.2) * 100))}%`,
              background: reading.tone,
            }}
          />
          <span className="dr-meter-mark" style={{ left: `${((1 - 0.6) / 1.2) * 100}%` }} />
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
