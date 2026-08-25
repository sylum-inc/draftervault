import { useMemo, useState } from 'react';

export interface ScatterPoint {
  id: string;
  name: string;
  position: string;
  x: number;
  y: number;
  drafted?: boolean;
}

interface QuadrantScatterProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  /** Reads clockwise from top-right, the way the quadrants are drawn. */
  quadrants: [string, string, string, string];
  highlightId?: string | null;
  onSelect?: (id: string) => void;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  height?: number;
}

const PAD = { top: 12, right: 14, bottom: 26, left: 34 };

/**
 * Two measures against each other, with the corners named.
 *
 * A scatter is the only form that makes an outlier findable rather than
 * described — "cheap for the production" is a sentence, but the bottom-right
 * corner is a place you can point at. The quadrant labels do the work a legend
 * would otherwise do badly: they say what being in a corner *means*, so the
 * chart can be read without a key.
 *
 * Medians split the field rather than zero, because the question is always
 * relative to what else is on the board tonight.
 */
export const QuadrantScatter = ({
  points,
  xLabel,
  yLabel,
  quadrants,
  highlightId = null,
  onSelect,
  formatX = (value) => String(Math.round(value)),
  formatY = (value) => String(Math.round(value)),
  height = 260,
}: QuadrantScatterProps) => {
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);
  const WIDTH = 460;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const laid = useMemo(() => {
    if (points.length < 3) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const sx = (value: number) => PAD.left + ((value - xMin) / (xMax - xMin || 1)) * plotW;
    const sy = (value: number) => PAD.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotH;
    const mid = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    return { sx, sy, xMid: mid(xs), yMid: mid(ys), xMin, xMax, yMin, yMax };
  }, [points, plotW, plotH]);

  if (!laid) return null;
  const active = hovered ?? points.find((p) => p.id === highlightId) ?? null;

  return (
    <figure className="dr-scatter">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${yLabel} against ${xLabel} for ${points.length} players`}
        onMouseLeave={() => setHovered(null)}
      >
        <line
          x1={laid.sx(laid.xMid)}
          x2={laid.sx(laid.xMid)}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke="var(--dr-line)"
          strokeWidth="1"
        />
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={laid.sy(laid.yMid)}
          y2={laid.sy(laid.yMid)}
          stroke="var(--dr-line)"
          strokeWidth="1"
        />

        <text x={PAD.left + plotW - 4} y={PAD.top + 10} className="dr-quadrant" textAnchor="end">
          {quadrants[0]}
        </text>
        <text
          x={PAD.left + plotW - 4}
          y={PAD.top + plotH - 4}
          className="dr-quadrant"
          textAnchor="end"
        >
          {quadrants[1]}
        </text>
        <text x={PAD.left + 4} y={PAD.top + plotH - 4} className="dr-quadrant">
          {quadrants[2]}
        </text>
        <text x={PAD.left + 4} y={PAD.top + 10} className="dr-quadrant">
          {quadrants[3]}
        </text>

        {points.map((point) => {
          const isHigh = point.id === highlightId;
          const isHover = hovered?.id === point.id;
          return (
            <circle
              key={point.id}
              cx={laid.sx(point.x)}
              cy={laid.sy(point.y)}
              r={isHigh ? 6 : isHover ? 5 : 3.4}
              fill={
                point.drafted
                  ? 'var(--dr-ink-faint)'
                  : isHigh
                    ? 'var(--dr-value)'
                    : 'var(--dr-accent)'
              }
              fillOpacity={point.drafted ? 0.25 : isHigh || isHover ? 1 : 0.55}
              stroke={isHigh || isHover ? 'var(--dr-surface)' : 'none'}
              strokeWidth={isHigh || isHover ? 2 : 0}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onMouseEnter={() => setHovered(point)}
              onClick={() => onSelect?.(point.id)}
            >
              <title>{`${point.name} — ${xLabel} ${formatX(point.x)}, ${yLabel} ${formatY(point.y)}`}</title>
            </circle>
          );
        })}

        <text x={PAD.left + plotW / 2} y={height - 6} className="dr-axis-title" textAnchor="middle">
          {xLabel} →
        </text>
        <text
          x={-(PAD.top + plotH / 2)}
          y={11}
          className="dr-axis-title"
          textAnchor="middle"
          transform="rotate(-90)"
        >
          {yLabel} →
        </text>
      </svg>

      <figcaption className="dr-scatter-readout">
        {active ? (
          <>
            <strong>{active.name}</strong>
            <span className="dr-pos-chip">{active.position}</span>
            <span className="dr-num">
              {xLabel} {formatX(active.x)}
            </span>
            <span className="dr-num">
              {yLabel} {formatY(active.y)}
            </span>
          </>
        ) : (
          <span className="dr-ink-muted">Hover a dot. Lines are the median of each axis.</span>
        )}
      </figcaption>
    </figure>
  );
};
