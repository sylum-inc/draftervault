import { useMemo, useState } from 'react';

export interface SwarmPoint {
  id: string;
  name: string;
  value: number;
}

interface PositionSwarmProps {
  points: SwarmPoint[];
  /** The player this chart is about; drawn on top of the field. */
  highlightId: string;
  label: string;
  position: string;
  format?: (value: number) => string;
  /** Marked as a vertical rule — replacement level, a rival's number, a budget. */
  reference?: { value: number; label: string } | null;
}

const WIDTH = 320;
const HEIGHT = 76;
const PAD_X = 6;
const DOT = 3.1;

/**
 * The whole position as points, with one of them lit.
 *
 * A percentile collapses a distribution to a single number and throws away its
 * shape — it cannot tell you that the top six running backs are miles clear of
 * the seventh, or that forty receivers are piled on the same value. The swarm
 * keeps the shape: clusters are visibly dense, gaps are visibly empty, and the
 * player in question is somewhere in it rather than described in the abstract.
 *
 * One hue, because this is magnitude. The field is recessive; only the subject
 * and the reference line carry weight.
 */
export const PositionSwarm = ({
  points,
  highlightId,
  label,
  position,
  format = (value) => String(Math.round(value)),
  reference = null,
}: PositionSwarmProps) => {
  const [hovered, setHovered] = useState<SwarmPoint | null>(null);

  const laid = useMemo(() => {
    if (points.length < 4) return null;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const x = (value: number) => PAD_X + ((value - min) / span) * (WIDTH - PAD_X * 2);

    // Beeswarm by column packing: bucket on the x pixel, then stack outward from
    // the centre line so a dense cluster grows into a visible column instead of
    // forty dots overprinting each other at one coordinate.
    const columns = new Map<number, number>();
    const placed = [...points]
      .sort((a, b) => a.value - b.value)
      .map((point) => {
        const px = x(point.value);
        const bucket = Math.round(px / (DOT * 1.6));
        const depth = columns.get(bucket) ?? 0;
        columns.set(bucket, depth + 1);
        // 0, +1, -1, +2, -2 … keeps the swarm centred on its own axis.
        const offset = depth === 0 ? 0 : Math.ceil(depth / 2) * (depth % 2 === 1 ? 1 : -1);
        return { ...point, cx: px, cy: HEIGHT / 2 + offset * (DOT * 1.75) };
      });

    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { placed, x, median, min, max };
  }, [points]);

  if (!laid) return null;

  const subject = laid.placed.find((point) => point.id === highlightId);
  const active = hovered ?? subject ?? null;

  return (
    <figure className="dr-swarm">
      <figcaption className="dr-swarm-head">
        <span className="dr-eyebrow">{label}</span>
        {active && (
          <span className="dr-swarm-readout">
            <strong className={active.id === highlightId ? 'is-subject' : undefined}>
              {active.name}
            </strong>
            <span className="dr-num">{format(active.value)}</span>
          </span>
        )}
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={
          subject
            ? `${label}: ${subject.name} at ${format(subject.value)}, against all ${points.length} ${position}s, whose median is ${format(laid.median)}`
            : `${label} across all ${points.length} ${position}s`
        }
        onMouseLeave={() => setHovered(null)}
      >
        <line
          x1={laid.x(laid.median)}
          x2={laid.x(laid.median)}
          y1={4}
          y2={HEIGHT - 4}
          stroke="var(--dr-line-strong)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        {reference && reference.value >= laid.min && reference.value <= laid.max && (
          <line
            x1={laid.x(reference.value)}
            x2={laid.x(reference.value)}
            y1={2}
            y2={HEIGHT - 2}
            stroke="var(--dr-caution)"
            strokeWidth="1.5"
          />
        )}

        {laid.placed.map((point) => {
          const isSubject = point.id === highlightId;
          return (
            <circle
              key={point.id}
              cx={point.cx}
              cy={point.cy}
              r={isSubject ? DOT + 1.4 : DOT}
              fill={isSubject ? 'var(--dr-value)' : 'var(--dr-ink-faint)'}
              fillOpacity={isSubject ? 1 : hovered?.id === point.id ? 0.9 : 0.42}
              // A 2px ring in the surface colour keeps the lit dot readable even
              // when the swarm is packed tight around it.
              stroke={isSubject ? 'var(--dr-surface)' : 'none'}
              strokeWidth={isSubject ? 2 : 0}
              onMouseEnter={() => setHovered(point)}
            >
              <title>{`${point.name} — ${format(point.value)}`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="dr-swarm-axis">
        <span className="dr-num">{format(laid.min)}</span>
        <span>
          median <span className="dr-num">{format(laid.median)}</span>
          {reference && (
            <em>
              {' · '}
              {reference.label} <span className="dr-num">{format(reference.value)}</span>
            </em>
          )}
        </span>
        <span className="dr-num">{format(laid.max)}</span>
      </div>
    </figure>
  );
};
