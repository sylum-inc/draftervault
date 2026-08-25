import { useMemo } from 'react';
import type { AuctionDraftService, Player } from '@/services/auctionDraftService';
import { getIdentity } from '@/services/nflIdentity';

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
 */
export const BargainBoard = ({ service, players, onSelect }: BargainBoardProps) => {
  const rows = useMemo(
    () => service.getBargains(30),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [service, players]
  );

  if (!rows.length) {
    return <p className="dr-empty dr-panel">No market data for the players still available.</p>;
  }

  const widest = Math.max(...rows.map((row) => Math.abs(row.edge)), 1);

  return (
    <div className="dr-bargains dr-panel">
      <header className="dr-bargains-head">
        <span className="dr-eyebrow">Our board vs consensus</span>
        <span className="dr-footnote" style={{ margin: 0 }}>
          {rows[0]?.player.market?.asOf ?? ''}
        </span>
      </header>

      <ol className="dr-bargain-list">
        {rows.map((row) => {
          const name = getIdentity(row.player.id)?.name ?? row.player.name;
          const positive = row.edge > 0;
          return (
            <li key={row.player.id}>
              <button type="button" className="dr-bargain" onClick={() => onSelect(row.player)}>
                <span className="dr-bargain-name">
                  <strong>{name}</strong>
                  <em>
                    {row.player.position} · {row.player.team}
                  </em>
                </span>

                <span className="dr-bargain-gap" aria-hidden="true">
                  <span
                    className={`dr-bargain-fill${positive ? '' : ' is-negative'}`}
                    style={{ width: `${(Math.abs(row.edge) / widest) * 100}%` }}
                  />
                </span>

                <span className="dr-bargain-numbers">
                  <span className="dr-num" title="Our rank">
                    #{row.player.adp}
                  </span>
                  <em>vs</em>
                  <span className="dr-num" title="Consensus rank">
                    #{row.player.market?.consensusRank}
                  </span>
                  <span
                    className="dr-num dr-bargain-edge"
                    style={{ color: positive ? 'var(--dr-value)' : 'var(--dr-caution)' }}
                  >
                    {positive ? '+' : ''}
                    {row.edge}
                  </span>
                  <span className="dr-num dr-bargain-price">${row.listed}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="dr-footnote">
        A positive gap means the consensus ranks him below our board — the bidding should stay
        quiet. Negative means expect company. Prices are our own valuation.
      </p>
    </div>
  );
};
