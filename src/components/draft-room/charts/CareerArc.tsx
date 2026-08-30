import type { CareerSeason } from '@/services/playerHistory';

interface CareerArcProps {
  seasons: CareerSeason[];
  /** Games missed per season, drawn under the arc. */
  missed?: Array<{ season: number; missed: number }>;
}

const WIDTH = 420;
const HEIGHT = 150;
const PAD = { top: 12, right: 12, bottom: 34, left: 32 };

/**
 * A whole career, with the games he was not there for.
 *
 * Three seasons say whether a player is good now. The arc says what shape he is
 * on — a twenty-eight-year-old's third straight decline and a second-year jump
 * are the same projection with completely different futures, and a projection
 * cannot show either. Bars under the line are games missed, on the same axis,
 * because "his down year" and "the year he played nine games" are usually the
 * same year and should not have to be joined up in the reader's head.
 */
export const CareerArc = ({ seasons, missed = [] }: CareerArcProps) => {
  if (seasons.length < 2) return null;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(...seasons.map((season) => season.pointsPerGame), 1);
  const missedBySeason = new Map(missed.map((row) => [row.season, row.missed]));

  const x = (index: number) => PAD.left + (index / Math.max(1, seasons.length - 1)) * plotW;
  const y = (value: number) => PAD.top + (1 - value / max) * plotH;

  const line = seasons
    .map(
      (season, i) =>
        `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(season.pointsPerGame).toFixed(1)}`
    )
    .join(' ');
  const peak = seasons.reduce((best, season) =>
    season.pointsPerGame > best.pointsPerGame ? season : best
  );

  return (
    <figure className="dr-arc">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Points per game by season from ${seasons[0].season} to ${seasons[seasons.length - 1].season}, peaking at ${peak.pointsPerGame} in ${peak.season}.`}
      >
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--dr-line)"
        />

        {seasons.map((season, i) => {
          const gone = missedBySeason.get(season.season) ?? 0;
          if (!gone) return null;
          const h = Math.min(plotH * 0.3, gone * 4);
          return (
            <rect
              key={`missed-${season.season}`}
              x={x(i) - 4}
              y={PAD.top + plotH}
              width={8}
              height={h}
              fill="var(--dr-danger)"
              fillOpacity="0.55"
            >
              <title>{`${season.season}: ${gone} game${gone === 1 ? '' : 's'} missed`}</title>
            </rect>
          );
        })}

        <path
          d={line}
          fill="none"
          stroke="var(--dr-value)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {seasons.map((season, i) => (
          <circle
            key={season.season}
            cx={x(i)}
            cy={y(season.pointsPerGame)}
            r={season.season === peak.season ? 5 : 3.4}
            fill={season.season === peak.season ? 'var(--dr-value)' : 'var(--dr-surface)'}
            stroke="var(--dr-value)"
            strokeWidth="1.8"
          >
            <title>
              {`${season.season} (${season.team}${season.age ? `, age ${season.age}` : ''}) — ${season.pointsPerGame} ppg over ${season.games} games`}
            </title>
          </circle>
        ))}

        {/* Only the ends and the peak are labelled: a number on every point is
            noise, and these are the three anyone actually reads. */}
        {[0, seasons.length - 1].map((i) => (
          <text
            key={`x-${i}`}
            x={x(i)}
            y={HEIGHT - 18}
            className="dr-axis-title"
            textAnchor="middle"
          >
            {seasons[i].season}
          </text>
        ))}
        <text x={4} y={PAD.top + 8} className="dr-axis-title">
          {max.toFixed(0)}
        </text>
      </svg>

      <figcaption className="dr-arc-key">
        <span>
          <em>Best year</em>
          <strong className="dr-num">
            {peak.season} · {peak.pointsPerGame} ppg
          </strong>
        </span>
        <span>
          <em>Seasons</em>
          <strong className="dr-num">{seasons.length}</strong>
        </span>
        <span>
          <em>Games</em>
          <strong className="dr-num">
            {seasons.reduce((total, season) => total + season.games, 0)}
          </strong>
        </span>
      </figcaption>
      <p className="dr-footnote">
        Line is points per game; red bars beneath are games missed to injury that season.
      </p>
    </figure>
  );
};
