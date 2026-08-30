interface BidLadderProps {
  openingBid: number;
  targetBid: number;
  maxBid: number;
  walkAway: number;
  /** What is currently typed into the bid box, if anything. */
  currentBid?: number;
}

/**
 * The four numbers that matter while the bidding is live, on one scale.
 *
 * A bidder does not need a table of prices — they need to know, at a glance,
 * whether the number just shouted is still inside the range. The band runs from
 * the opening bid to the maximum, and the live bid rides above it so crossing
 * the line is visible before it is expensive.
 */
export const BidLadder = ({
  openingBid,
  targetBid,
  maxBid,
  walkAway,
  currentBid,
}: BidLadderProps) => {
  const top = Math.max(walkAway, currentBid ?? 0) * 1.08;
  const at = (value: number) => Math.max(0, Math.min(100, (value / top) * 100));
  const over = currentBid != null && currentBid > maxBid;

  return (
    <div className="dr-ladder">
      <div className="dr-ladder-track">
        <span
          className="dr-ladder-band"
          style={{ left: `${at(openingBid)}%`, width: `${at(targetBid) - at(openingBid)}%` }}
        />
        <span
          className="dr-ladder-band is-premium"
          style={{ left: `${at(targetBid)}%`, width: `${at(maxBid) - at(targetBid)}%` }}
        />
        <span
          className="dr-ladder-tick"
          style={{ left: `${at(targetBid)}%` }}
          title={`Target $${targetBid}`}
        />
        <span
          className="dr-ladder-tick is-limit"
          style={{ left: `${at(maxBid)}%` }}
          title={`Maximum $${maxBid}`}
        />
        {currentBid != null && currentBid > 0 && (
          <span
            className={`dr-ladder-live${over ? ' is-over' : ''}`}
            style={{ left: `${at(currentBid)}%` }}
            title={`Current bid $${currentBid}`}
          >
            <span className="dr-num">${currentBid}</span>
          </span>
        )}
      </div>

      <div className="dr-ladder-labels">
        <span>
          <em>Open</em>
          <strong className="dr-num">${openingBid}</strong>
        </span>
        <span>
          <em>Target</em>
          <strong className="dr-num">${targetBid}</strong>
        </span>
        <span>
          <em>Max</em>
          <strong className="dr-num">${maxBid}</strong>
        </span>
        <span>
          <em>Walk away</em>
          <strong className="dr-num" style={{ color: 'var(--dr-danger)' }}>
            ${walkAway}
          </strong>
        </span>
      </div>
    </div>
  );
};
