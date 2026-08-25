interface RangeBarProps {
  floor: number;
  projection: number;
  ceiling: number;
  /** Points a freely available player at this position would score. */
  replacement?: number;
}

/**
 * The season this player is likely to have, as a range rather than a number.
 *
 * Floor and ceiling are one standard deviation of the season total either side
 * of the projection — the spread of a sum of games, not of a single game — so
 * the width of this bar is a real statement about how predictable someone is.
 */
export const RangeBar = ({ floor, projection, ceiling, replacement }: RangeBarProps) => {
  // Give the scale a little air either side so the end caps are not clipped.
  const lower = Math.min(floor, replacement ?? floor);
  const pad = Math.max(8, (ceiling - lower) * 0.08);
  const min = Math.max(0, lower - pad);
  const max = ceiling + pad;
  const at = (value: number) => ((value - min) / (max - min)) * 100;

  return (
    <div className="dr-range">
      <div className="dr-range-track">
        <span
          className="dr-range-span"
          style={{ left: `${at(floor)}%`, width: `${at(ceiling) - at(floor)}%` }}
        />
        {replacement != null && replacement > min && (
          <span
            className="dr-range-replacement"
            style={{ left: `${at(replacement)}%` }}
            title={`Replacement level: ${Math.round(replacement)} points`}
          />
        )}
        <span className="dr-range-point" style={{ left: `${at(projection)}%` }} />
      </div>

      <div className="dr-range-labels">
        <span>
          <em>Floor</em>
          <strong className="dr-num">{floor}</strong>
        </span>
        <span className="dr-range-mid">
          <em>Projected</em>
          <strong className="dr-num">{projection}</strong>
        </span>
        <span className="dr-range-end">
          <em>Ceiling</em>
          <strong className="dr-num">{ceiling}</strong>
        </span>
      </div>
    </div>
  );
};
