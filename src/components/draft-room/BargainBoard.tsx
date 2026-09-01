import { useMemo } from 'react';
import type { AuctionDraftService, Player } from '@/services/auctionDraftService';
import { getIdentity } from '@/services/nflIdentity';
import { CONSENSUS_VERDICT, modelCaveats } from '@/lib/modelTrust';

interface BargainBoardProps {
  service: AuctionDraftService;
  players: Player[];
  onSelect: (player: Player) => void;
}

/**
 * Where our board and the room's disagree.
 *
 * Every number here is a difference between two rankings that were produced
 * independently: ours from production and opportunity, theirs from a panel of
 * analysts. The gap is not evidence that we are right — it is evidence that the
 * bidding will be quiet, which is the only thing that actually makes a player
 * cheap. Players the consensus likes *more* than we do are shown too, at the
 * bottom, because knowing where you will be outbid is worth as much.
 *
 * That caveat used to live only in this comment, and `npm run backtest` turned
 * it from a hedge into a measurement: over three held-out seasons the market's
 * board sorted these players better than ours in 11 of 12 position-seasons, and
 * on the widest disagreements the market finished nearer the truth every year.
 * A panel whose entire subject is the size of a gap cannot state that only in a
 * file nobody reads on the night, so `modelTrust.ts` states it at the top and
 * flags the rows sitting in the model's three documented blind spots. It is the
 * same number the board was always showing; what changed is that the room now
 * knows which way it leans.
 */
export const BargainBoard = ({ service, players, onSelect }: BargainBoardProps) => {
  const rows = useMemo(
    () => service.getBargains(30),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [service, players]
  );

  if (!rows.length) {
    return (
      <section className="dr-panel dr-rail" aria-label="Bargains">
        <header className="dr-rail-head">
          <h2 className="dr-eyebrow">Bargains</h2>
        </header>
        <p className="dr-empty">No market data for the players still available.</p>
      </section>
    );
  }

  // Scaled on the dollar gap, which is now the sort key: a bar drawn from the
  // rank difference would have the longest bar on a row near the bottom.
  const widest = Math.max(...rows.map((row) => Math.abs(row.gap)), 1);

  return (
    <div className="dr-bargains dr-panel">
      <header className="dr-bargains-head">
        <span className="dr-eyebrow">Our board vs consensus</span>
        <span className="dr-footnote" style={{ margin: 0 }}>
          {rows[0]?.player.market?.asOf ?? ''}
        </span>
      </header>

      <p className="dr-bargain-verdict">{CONSENSUS_VERDICT}</p>

      <ol className="dr-bargain-list">
        {rows.map((row) => {
          const name = getIdentity(row.player.id)?.name ?? row.player.name;
          const positive = row.gap > 0;
          // Only where our board is the one claiming the edge. On a player the
          // room likes more than we do, our number is not what a bid would be
          // trusting, so a caveat about our accuracy is noise at the moment it
          // is read.
          const caveats = positive ? modelCaveats(row.player) : [];
          return (
            <li key={row.player.id}>
              <button type="button" className="dr-bargain" onClick={() => onSelect(row.player)}>
                <span className="dr-bargain-name">
                  <strong>{name}</strong>
                  <em>
                    {row.player.position} · {row.player.team}
                    {caveats.map((caveat) => (
                      <span key={caveat.id} className="dr-bargain-caveat" title={caveat.detail}>
                        {caveat.label}
                      </span>
                    ))}
                  </em>
                </span>

                <span className="dr-bargain-gap" aria-hidden="true">
                  <span
                    className={`dr-bargain-fill${positive ? '' : ' is-negative'}`}
                    style={{ width: `${(Math.abs(row.gap) / widest) * 100}%` }}
                  />
                </span>

                <span className="dr-bargain-numbers">
                  {/* `modelRank` and not `adp`, for the reason `gap` reads
                      `modelValue`: `adp` is whatever is driving the board, so
                      after "Use consensus" this printed the market's rank
                      under the label "our rank" and had the panel disagreeing
                      with itself about who disagreed with whom. */}
                  <span className="dr-num" title="Our rank">
                    #{row.player.modelRank}
                  </span>
                  <em>vs</em>
                  <span className="dr-num" title="Consensus rank">
                    #{row.player.market?.consensusRank}
                  </span>
                  <span
                    className="dr-num dr-bargain-edge"
                    style={{ color: positive ? 'var(--dr-value)' : 'var(--dr-caution)' }}
                    title={`We price him $${row.player.modelValue}; at the market's rank he prices $${row.player.modelValue - row.gap}. The room should pay about $${row.projectedCost}.`}
                  >
                    {positive ? '+' : '−'}${Math.abs(row.gap)}
                  </span>
                  <span className="dr-num dr-bargain-price">${row.listed}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="dr-footnote">
        The dollar figure is what the disagreement is worth: ours minus what he prices at the
        market&rsquo;s rank. Positive means the bidding should stay quiet, negative means expect
        company. Sorted by that rather than by rank difference, because a hundred places between two
        $2 players is a dollar. Amber chips mark the three places the backtest found our board least
        reliable; hover one for what was measured.
      </p>
    </div>
  );
};
