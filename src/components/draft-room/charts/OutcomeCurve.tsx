interface OutcomeCurveProps {
  projection: number;
  floor: number;
  ceiling: number;
  /** The last player at this position the league actually rosters. */
  replacement?: number | null;
  /** A rival's projection, drawn as a second rule when comparing. */
  benchmark?: { value: number; label: string } | null;
}

const WIDTH = 320;
const HEIGHT = 92;
const BASE = HEIGHT - 16;

/**
 * The season as a distribution rather than a number.
 *
 * "266 points" is a mean nobody will actually score. What matters at a bid is
 * how wide the outcomes are around it and how much of that range clears
 * replacement level — a boom/bust receiver and a metronome tight end can share
 * a projection and be completely different purchases.
 *
 * The curve is a normal built from the same mean and season deviation that
 * produce the floor and ceiling, so it is a picture of the numbers already on
 * the card, not a second opinion. The area below replacement is shaded away:
 * that is the part of the range where the pick did not need to happen.
 */
export const OutcomeCurve = ({
  projection,
  floor,
  ceiling,
  replacement = null,
  benchmark = null,
}: OutcomeCurveProps) => {
  // Floor and ceiling are one season deviation either side of the mean.
  const sigma = Math.max(1, (ceiling - floor) / 2);
  const min = Math.max(0, projection - sigma * 2.6);
  const max = projection + sigma * 2.6;
  const span = max - min || 1;
  const x = (value: number) => ((value - min) / span) * WIDTH;
  const density = (value: number) => Math.exp(-0.5 * ((value - projection) / sigma) ** 2);

  const steps = 72;
  const curve: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const value = min + (span * i) / steps;
    curve.push([x(value), BASE - density(value) * (BASE - 8)]);
  }
  const path = curve
    .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ');

  const clip = (from: number, to: number) =>
    `M${x(from).toFixed(1)},${BASE} ` +
    curve
      .filter(([px]) => px >= x(from) && px <= x(to))
      .map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`)
      .join(' ') +
    ` L${x(to).toFixed(1)},${BASE} Z`;

  const clearsReplacement =
    replacement != null
      ? Math.round((1 - normalCdf((replacement - projection) / sigma)) * 100)
      : null;

  return (
    <figure className="dr-curve">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={
          `Projected ${Math.round(projection)} points, with a likely range of ${floor} to ${ceiling}` +
          (clearsReplacement != null
            ? `. About ${clearsReplacement} per cent of outcomes clear replacement level.`
            : '')
        }
      >
        {/* The middle two thirds: floor to ceiling, one deviation either way. */}
        <path d={clip(floor, ceiling)} fill="var(--dr-value)" fillOpacity="0.22" />
        {replacement != null && replacement > min && (
          <path
            d={clip(min, Math.min(replacement, max))}
            fill="var(--dr-danger)"
            fillOpacity="0.16"
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="var(--dr-value)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        <line
          x1={x(projection)}
          x2={x(projection)}
          y1={6}
          y2={BASE}
          stroke="var(--dr-value)"
          strokeWidth="1.5"
        />
        {replacement != null && replacement > min && replacement < max && (
          <line
            x1={x(replacement)}
            x2={x(replacement)}
            y1={12}
            y2={BASE}
            stroke="var(--dr-danger)"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        )}
        {benchmark && benchmark.value > min && benchmark.value < max && (
          <line
            x1={x(benchmark.value)}
            x2={x(benchmark.value)}
            y1={12}
            y2={BASE}
            stroke="var(--dr-caution)"
            strokeWidth="1.5"
          />
        )}
        <line x1={0} x2={WIDTH} y1={BASE} y2={BASE} stroke="var(--dr-line)" strokeWidth="1" />
      </svg>

      <figcaption className="dr-curve-key">
        <span>
          <em>Floor</em>
          <strong className="dr-num">{floor}</strong>
        </span>
        <span>
          <em>Projection</em>
          <strong className="dr-num" style={{ color: 'var(--dr-value)' }}>
            {Math.round(projection)}
          </strong>
        </span>
        <span>
          <em>Ceiling</em>
          <strong className="dr-num">{ceiling}</strong>
        </span>
        {clearsReplacement != null && (
          <span>
            <em>Beats replacement</em>
            <strong className="dr-num">{clearsReplacement}%</strong>
          </span>
        )}
      </figcaption>
    </figure>
  );
};

/** Abramowitz & Stegun 7.1.26, which is plenty for a percentage on a card. */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absZ);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-absZ * absZ);
  return 0.5 * (1 + sign * y);
}
