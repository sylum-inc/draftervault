export interface TierRow {
  position: string;
  /** Players left at each tier, tier 1 first. */
  remaining: number[];
  /** How many there were before the draft started. */
  started: number[];
}

interface TierDepletionProps {
  rows: TierRow[];
}

/**
 * What is left, by position and tier.
 *
 * The single most expensive mistake in an auction is not noticing that a
 * position emptied out. This is deliberately a stacked bar of counts rather
 * than a percentage: "two tier-one backs left" is an actionable number, and
 * "18% remaining" is not. The ghost behind each bar is where it started, so
 * the run that just happened is visible as the gap.
 */
export const TierDepletion = ({ rows }: TierDepletionProps) => {
  const max = Math.max(...rows.flatMap((row) => row.started.reduce((a, b) => a + b, 0)), 1);

  return (
    <div className="dr-depletion">
      {rows.map((row) => {
        const left = row.remaining.reduce((a, b) => a + b, 0);
        const began = row.started.reduce((a, b) => a + b, 0);
        return (
          <div className="dr-depletion-row" key={row.position}>
            <span className="dr-depletion-position">{row.position}</span>
            <span className="dr-depletion-track">
              <span className="dr-depletion-ghost" style={{ width: `${(began / max) * 100}%` }} />
              {row.remaining.map((count, tier) => (
                <span
                  key={tier}
                  className="dr-depletion-seg"
                  style={{
                    width: `${(count / max) * 100}%`,
                    // One hue, stepped by tier: this is a magnitude, not four
                    // unrelated categories, so it must not read as a palette.
                    // On a dark ground more opacity reads as stronger, not darker.
                    opacity: 1 - tier * 0.22,
                  }}
                  title={`${count} tier-${tier + 1} ${row.position}${count === 1 ? '' : 's'} left of ${row.started[tier]}`}
                />
              ))}
            </span>
            <span className="dr-num dr-depletion-count">
              {left}
              <em>/{began}</em>
            </span>
          </div>
        );
      })}
      <p className="dr-footnote">
        Segments are tiers, strongest first. The faint bar behind each row is where the position
        started, so the gap is the run that has already happened.
      </p>
    </div>
  );
};
