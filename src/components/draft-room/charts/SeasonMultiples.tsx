import type { PlayerSeason } from '@/services/playerHistory';

interface SeasonMultiplesProps {
  seasons: PlayerSeason[];
}

const WIDTH = 150;
const HEIGHT = 44;
const PADDING = 3;

/**
 * Three seasons side by side on one shared scale.
 *
 * Small multiples rather than three overlaid lines: the question is whether a
 * player is trending up, and putting the seasons next to each other on the same
 * axis answers it without asking anyone to untangle colors. The shared maximum
 * is what makes the comparison honest.
 */
export const SeasonMultiples = ({ seasons }: SeasonMultiplesProps) => {
  const plotted = seasons.filter((season) => season.weekly.length > 1);
  if (plotted.length < 2) return null;

  const max = Math.max(...plotted.flatMap((season) => season.weekly), 1);

  return (
    <div className="dr-multiples">
      {plotted.map((season) => {
        const step = (WIDTH - PADDING * 2) / Math.max(1, season.weekly.length - 1);
        const y = (value: number) => PADDING + (HEIGHT - PADDING * 2) * (1 - value / max);
        const points = season.weekly
          .map((value, index) => `${PADDING + index * step},${y(value)}`)
          .join(' ');

        return (
          <figure className="dr-multiple" key={season.season}>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              width="100%"
              height={HEIGHT}
              role="img"
              aria-label={`${season.season}: ${season.pointsPerGame} points per game across ${season.games} games`}
            >
              <polyline
                points={points}
                fill="none"
                stroke="var(--dr-value)"
                strokeWidth="1.6"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <figcaption>
              <strong className="dr-num">{season.season}</strong>
              <span className="dr-num">{season.pointsPerGame}</span>
              <em>ppg</em>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
};
