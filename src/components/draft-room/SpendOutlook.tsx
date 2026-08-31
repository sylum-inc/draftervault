import { useMemo } from 'react';
import type { AuctionDraftService, Player } from '@/services/auctionDraftService';
import { outlookHeadline } from '@/lib/snakeOutlook';

interface SpendOutlookProps {
  service: AuctionDraftService;
  /** The change signal for a pick; the engine holds the facts. */
  players: Player[];
}

/**
 * Where the money is worth spending, and where the snake covers it for free.
 *
 * The panel that answers the question this format actually turns on. In an
 * ordinary auction every roster spot has to be bought, so the only decision is
 * how to divide the money. Here a sheet of fifty is bought and eleven or twelve
 * seats a team are snaked for nothing, with no minimum anybody has to spend —
 * so the question is not what a player is worth, it is how much better he is
 * than the man you will get for free at the same position.
 *
 * That number is not `vorp`. VORP measures against the last man the *league*
 * rosters, which is the right bar only when the auction buys the whole roster.
 * Here the alternative is whoever survives to your own snake slot.
 *
 * Sorted by gain rather than by position, because the order of the rows is the
 * recommendation: the top row is where a dollar buys the most.
 */
export const SpendOutlook = ({ service, players }: SpendOutlookProps) => {
  const outlook = useMemo(
    () => service.getSpendOutlook(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [service, players]
  );

  if (!outlook.positions) {
    return <p className="dr-empty dr-panel">{outlook.reason}</p>;
  }

  const rows = [...outlook.positions].sort((a, b) => b.gain - a.gain);
  const widest = Math.max(...rows.map((row) => Math.abs(row.gain)), 1);

  return (
    <div className="dr-outlook dr-panel">
      <header className="dr-bargains-head">
        <span className="dr-eyebrow">What money buys over the snake</span>
        <span className="dr-footnote" style={{ margin: 0 }}>
          at your pick {outlook.atOverall}
        </span>
      </header>

      <p className="dr-outlook-verdict">{outlookHeadline(outlook)}</p>

      <ol className="dr-outlook-list">
        {rows.map((row) => {
          const positive = row.gain > 0;
          return (
            <li key={row.position}>
              <div className="dr-outlook-head">
                <strong className="dr-pos">{row.position}</strong>
                <span
                  className="dr-num dr-outlook-gain"
                  style={{ color: positive ? 'var(--dr-value)' : 'var(--dr-ink-faint)' }}
                  title="Projected points the auction buys over the free alternative"
                >
                  {positive ? '+' : ''}
                  {row.gain} pts
                </span>
                <span className="dr-num dr-outlook-rate">
                  {row.gainPerDollar ? `${row.gainPerDollar}/$` : '—'}
                </span>
              </div>

              <div className="dr-outlook-gap" aria-hidden="true">
                <span
                  className={`dr-outlook-fill${positive ? '' : ' is-flat'}`}
                  style={{ width: `${(Math.abs(row.gain) / widest) * 100}%` }}
                />
              </div>

              <p className="dr-outlook-detail">
                {row.forSale ? (
                  <>
                    <b>{row.forSale.name}</b> at ${row.forSale.price} · {row.forSale.points} pts
                  </>
                ) : (
                  <span className="dr-outlook-none">nothing left for sale here</span>
                )}
              </p>
              <p className="dr-outlook-detail dr-outlook-free">
                {row.free ? (
                  <>
                    free at your pick: {row.free.name} · {row.free.points} pts
                    {row.goneBefore > 0 && ` (${row.goneBefore} gone before you)`}
                  </>
                ) : (
                  'nobody left at this position'
                )}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="dr-footnote">
        Assumes the room snakes in the board&rsquo;s current order — the draft market&rsquo;s, once
        you have pressed Use consensus. Who is <em>gone</em> is the room&rsquo;s call; who you take
        from what is left is yours, so the free man is the best survivor by points.
      </p>
    </div>
  );
};
