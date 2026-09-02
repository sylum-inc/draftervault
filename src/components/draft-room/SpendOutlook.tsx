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
    return <SpendSpread service={service} players={players} reason={outlook.reason} />;
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

/**
 * The same answer before the order has been drawn.
 *
 * The panel used to print the refusal and stop, which was honest and left the
 * one decision this format turns on unplannable for the whole month before
 * draft night — over a single missing input that can be *bounded* rather than
 * guessed. Every row here is a number `snakeOutlook` would print at some draw,
 * and the true one is among them.
 *
 * The rows the draw cannot move lead, because those are the ones that can be
 * decided now, and they are marked as such. It falls back to the plain refusal
 * for everything the draw cannot stand in for — no sheet means no snake half,
 * and no team marked means no roster to measure against.
 */
const SpendSpread = ({
  service,
  players,
  reason,
}: SpendOutlookProps & { reason: string | null }) => {
  const spread = useMemo(
    () => service.getSpendSpread(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [service, players]
  );

  if (!spread.positions)
    return (
      <section className="dr-panel dr-rail" aria-label="Spend outlook">
        <header className="dr-rail-head">
          <h2 className="dr-eyebrow">Spend</h2>
        </header>
        <p className="dr-empty">{reason ?? spread.reason}</p>
      </section>
    );

  // Settled first: those are the rows to plan on. Within each group, by what
  // the position is worth at its worst, so the ordering is a recommendation
  // that does not depend on a draw nobody has had yet.
  const rows = [...spread.positions].sort(
    (a, b) => Number(b.settled) - Number(a.settled) || b.low - a.low
  );
  const widest = Math.max(...rows.map((row) => Math.abs(row.high)), 1);

  return (
    <div className="dr-outlook dr-panel">
      <header className="dr-bargains-head">
        <span className="dr-eyebrow">What money buys over the snake</span>
        <span className="dr-footnote" style={{ margin: 0 }}>
          every draw
        </span>
      </header>

      <p className="dr-outlook-verdict">
        The snake order is not set, so this is the range across all{' '}
        {rows.length ? service.getTeams().length : 0} draws rather than one number. Rows marked{' '}
        <b>any draw</b> cannot move — decide those now.
      </p>

      <ol className="dr-outlook-list">
        {rows.map((row) => (
          <li key={row.position}>
            <div className="dr-outlook-head">
              <strong className="dr-pos">{row.position}</strong>
              <span
                className="dr-num dr-outlook-gain"
                style={{ color: row.high > 0 ? 'var(--dr-value)' : 'var(--dr-ink-faint)' }}
                title="Projected points the auction buys over the free alternative, at the best and worst draw"
              >
                {row.settled ? `+${row.high} pts` : `+${row.low} to +${row.high} pts`}
              </span>
              <span className="dr-num dr-outlook-rate">
                {row.perDollarHigh
                  ? row.settled
                    ? `${row.perDollarHigh}/$`
                    : `${row.perDollarLow}–${row.perDollarHigh}/$`
                  : '—'}
              </span>
            </div>

            <div className="dr-outlook-gap" aria-hidden="true">
              <span
                className={`dr-outlook-fill${row.high > 0 ? '' : ' is-flat'}`}
                style={{ width: `${(Math.abs(row.high) / widest) * 100}%` }}
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
              {row.settled ? (
                <>
                  <b>any draw</b>: {row.bestFree?.name ?? 'nobody'} survives to you
                </>
              ) : (
                <>
                  picking first: {row.bestFree?.name ?? 'nobody'} · picking last:{' '}
                  {row.worstFree?.name ?? 'nobody'}
                </>
              )}
            </p>
          </li>
        ))}
      </ol>

      <p className="dr-footnote">
        Not an estimate of your draw — every figure is one this panel would print at some seat, and
        yours is one of them. Set the order in <b>Snake order</b> and this collapses to the single
        number for your pick.
      </p>
    </div>
  );
};
