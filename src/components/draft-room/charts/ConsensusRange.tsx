interface ConsensusRangeProps {
  /** Where the experts collectively put him. */
  consensus: number;
  best: number;
  worst: number;
  /** Our own board position, for the gap that matters. */
  ourRank: number;
  spread: number | null;
  asOf: string | null;
  source: string;
}

const WIDTH = 320;
const HEIGHT = 46;
const PAD = 8;

/**
 * How much the room disagrees about a player, and where we sit inside that.
 *
 * A consensus rank on its own is a false precision: "the 24th best player" is
 * an average of people who said 16th and people who said 41st. The band is the
 * disagreement, and it is the most useful thing on the card at an auction —
 * a player nobody agrees on is a player somebody will let go cheap.
 */
export const ConsensusRange = ({
  consensus,
  best,
  worst,
  ourRank,
  spread,
  asOf,
  source,
}: ConsensusRangeProps) => {
  const lo = Math.min(best, ourRank, consensus) - 2;
  const hi = Math.max(worst, ourRank, consensus) + 2;
  const span = hi - lo || 1;
  // Rank axes run backwards: rank 1 is the right-hand, most-valuable end.
  const x = (rank: number) => PAD + (1 - (rank - lo) / span) * (WIDTH - PAD * 2);
  const edge = consensus - ourRank;

  return (
    <figure className="dr-consensus">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Experts rank him between ${best} and ${worst}, consensus ${consensus}; our board has him ${ourRank}.`}
      >
        <line x1={PAD} x2={WIDTH - PAD} y1={26} y2={26} stroke="var(--dr-line)" strokeWidth="1" />
        <rect
          x={Math.min(x(worst), x(best))}
          y={20}
          width={Math.abs(x(best) - x(worst))}
          height={12}
          rx={4}
          fill="var(--dr-ink-faint)"
          fillOpacity="0.35"
        />
        <line
          x1={x(consensus)}
          x2={x(consensus)}
          y1={16}
          y2={36}
          stroke="var(--dr-ink)"
          strokeWidth="2"
        />
        <circle
          cx={x(ourRank)}
          cy={26}
          r={5}
          fill="var(--dr-value)"
          stroke="var(--dr-surface)"
          strokeWidth="2"
        />
        <text x={x(worst)} y={12} className="dr-consensus-tick" textAnchor="middle">
          {worst}
        </text>
        <text x={x(best)} y={12} className="dr-consensus-tick" textAnchor="middle">
          {best}
        </text>
      </svg>

      <figcaption className="dr-consensus-key">
        <span>
          <em>Consensus</em>
          <strong className="dr-num">#{consensus}</strong>
        </span>
        <span>
          <em>Our board</em>
          <strong className="dr-num" style={{ color: 'var(--dr-value)' }}>
            #{ourRank}
          </strong>
        </span>
        <span>
          <em>{edge > 0 ? 'We like him' : edge < 0 ? 'Room likes him' : 'Agreed'}</em>
          <strong className="dr-num">
            {edge === 0 ? '—' : `${Math.abs(edge)} spot${Math.abs(edge) === 1 ? '' : 's'}`}
          </strong>
        </span>
        {spread != null && (
          <span>
            <em>Disagreement</em>
            <strong className="dr-num">±{spread}</strong>
          </span>
        )}
      </figcaption>
      <p className="dr-footnote">
        {source}
        {asOf ? `, ${asOf}` : ''}. The bar spans the most and least optimistic expert.
      </p>
    </figure>
  );
};
