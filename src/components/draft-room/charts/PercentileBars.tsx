interface PercentileRow {
  label: string;
  /** 0-100 within the player's own position. */
  percentile: number;
  /** The underlying number, shown so the bar is never the only evidence. */
  value: string;
}

interface PercentileBarsProps {
  rows: PercentileRow[];
  position: string;
}

/**
 * Where each number sits among players at the same position.
 *
 * Sixty per cent of snaps is a committee back and a workhorse tight end, so the
 * raw figure is close to meaningless on its own. Length encodes magnitude in a
 * single hue — this is not a categorical palette — with the median marked, and
 * the real value printed beside every bar.
 */
export const PercentileBars = ({ rows, position }: PercentileBarsProps) => (
  <div className="dr-percentiles">
    {rows.map((row) => (
      <div className="dr-percentile" key={row.label}>
        <span className="dr-percentile-label">{row.label}</span>
        <span className="dr-percentile-track">
          <span
            className="dr-percentile-fill"
            style={{
              width: `${Math.max(2, row.percentile)}%`,
              opacity: 0.35 + (row.percentile / 100) * 0.65,
            }}
          />
          {/* The middle of the position, so a bar reads as above or below it. */}
          <span className="dr-percentile-median" />
        </span>
        <span className="dr-num dr-percentile-value">{row.value}</span>
        <span className="dr-num dr-percentile-rank">
          {row.percentile}
          <em>th</em>
        </span>
      </div>
    ))}
    <p className="dr-footnote">
      Percentile among the {position}s who beat replacement level — the men he is actually competing
      with for a roster spot, not the six hundred in the pool.
    </p>
  </div>
);
