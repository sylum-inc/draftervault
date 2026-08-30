import { useId, useState } from 'react';

interface SparklineProps {
  /** Points scored in each game played, in order. */
  values: number[];
  /** Accessible summary; the visual is decorative on its own. */
  label: string;
  height?: number;
}

const WIDTH = 320;
const PADDING = 4;

/**
 * One season of scoring, game by game.
 *
 * A single series, so there is no legend and no categorical palette to check —
 * the heading names it. The season average runs behind the line as a reference,
 * the final game is marked, and every game answers to hover, because the shape
 * of a season is the question and the individual weeks are the follow-up. The
 * same numbers appear in the season table beside it for anyone not using a
 * pointer.
 */
export const Sparkline = ({ values, label, height = 56 }: SparklineProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const plotHeight = height - PADDING * 2;

  const x = (index: number) => (index / (values.length - 1)) * (WIDTH - PADDING * 2) + PADDING;
  const y = (value: number) => PADDING + plotHeight - ((value - min) / span) * plotHeight;

  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `${PADDING},${height - PADDING} ${line} ${WIDTH - PADDING},${height - PADDING}`;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const lastIndex = values.length - 1;

  return (
    <figure className="dr-spark" aria-label={label}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dr-value)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--dr-value)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Season average, recessive, so a week reads as above or below form. */}
        <line
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={y(average)}
          y2={y(average)}
          stroke="var(--dr-line-strong)"
          strokeDasharray="3 4"
          strokeWidth="1"
        />

        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--dr-value)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* The most recent game, marked. */}
        <circle cx={x(lastIndex)} cy={y(values[lastIndex])} r="3.5" fill="var(--dr-value)" />

        {hovered !== null && (
          <circle
            cx={x(hovered)}
            cy={y(values[hovered])}
            r="4"
            fill="var(--dr-ink)"
            stroke="var(--dr-surface)"
            strokeWidth="2"
          />
        )}

        {/* Invisible hit targets, wider than the marks they stand for. */}
        {values.map((value, index) => (
          <rect
            key={index}
            x={x(index) - (WIDTH - PADDING * 2) / values.length / 2}
            y={0}
            width={(WIDTH - PADDING * 2) / values.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHovered(index)}
          >
            <title>{`Game ${index + 1}: ${value} points`}</title>
          </rect>
        ))}
      </svg>

      <figcaption className="dr-spark-caption">
        {hovered !== null ? (
          <>
            Game {hovered + 1} · <strong className="dr-num">{values[hovered]}</strong> pts
          </>
        ) : (
          <>
            {values.length} games · avg <strong className="dr-num">{average.toFixed(1)}</strong> ·
            best <strong className="dr-num">{max}</strong>
          </>
        )}
      </figcaption>
    </figure>
  );
};
