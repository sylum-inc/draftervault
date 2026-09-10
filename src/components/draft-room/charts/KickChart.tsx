import { useMemo, useState } from 'react';
import type { KickerSeason } from '@/services/kicking';
import { bucketsFor } from '@/services/kicking';
import { FAINT, GOOD, HOT, INK, TRACK, WARN } from './micro';

/**
 * Every kick he took last season, where he took it from, and what happened.
 *
 * A kicker's points are a function of two things the pool cannot see: how
 * often his offence stalls inside the forty, and whether he makes the long
 * ones when it does. Both are in the spray. Each row is a week, each mark an
 * attempt at its distance — a filled dot made it, a cross missed, a hollow
 * diamond was blocked — so a season reads left to right as chances and top to
 * bottom as the calendar. The two rules at forty and fifty are where a kick
 * stops being routine, and the buckets underneath say how he did in each
 * against the league's kickers as a whole, which is the only sensible
 * reference: a made fifty-five is not the same fact as a made twenty-five.
 */
interface KickChartProps {
  kicker: KickerSeason;
  /** The league's make rate per bucket, for the tick each of his is read against. */
  league: ReadonlyArray<{ label: string; rate: number | null }>;
  label: string;
  width?: number;
}

const MIN = 17;
const MAX = 66;
const ROW = 11;
/* Room on the left for the week number and the goalposts the kicks fly toward. */
const PAD_LEFT = 58;
const PAD_RIGHT = 54;
const WEEKS = 18;

type Mark = { week: number; distance: number; result: 'made' | 'missed' | 'blocked' };

export const KickChart = ({ kicker, league, label, width = 440 }: KickChartProps) => {
  const [hover, setHover] = useState<Mark | null>(null);
  const plot = width - PAD_LEFT - PAD_RIGHT;
  const x = (distance: number) =>
    PAD_LEFT + ((Math.min(MAX, Math.max(MIN, distance)) - MIN) / (MAX - MIN)) * plot;
  const y = (week: number) => 14 + (week - 1) * ROW + ROW / 2;
  const height = 14 + WEEKS * ROW + 18;

  const marks = useMemo<Mark[]>(
    () =>
      kicker.games.flatMap((game) => [
        ...game.made.map((distance) => ({ week: game.week, distance, result: 'made' as const })),
        ...game.missed.map((distance) => ({
          week: game.week,
          distance,
          result: 'missed' as const,
        })),
        ...game.blocked.map((distance) => ({
          week: game.week,
          distance,
          result: 'blocked' as const,
        })),
      ]),
    [kicker]
  );
  const byWeek = useMemo(() => new Map(kicker.games.map((game) => [game.week, game])), [kicker]);
  const buckets = useMemo(() => bucketsFor(kicker), [kicker]);

  const resting = `${kicker.made} of ${kicker.attempts} field goals, long ${kicker.long}; ${kicker.patMade} of ${kicker.patAtt} extra points`;

  return (
    <div className="dr-kick">
      <svg
        className="dr-kick-spray"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: ${resting}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* The field. Kicks fly leftward toward the posts; every ten yards a
            faint line, and the two distances where a kick stops being routine
            drawn darker. Alternate weeks carry a wash so a row can be followed
            across without a ruler. */}
        {Array.from({ length: WEEKS }, (_, index) =>
          index % 2 === 0 ? (
            <rect
              key={`turf-${index}`}
              x={PAD_LEFT - 10}
              y={y(index + 1) - ROW / 2}
              width={plot + 10}
              height={ROW}
              fill="var(--dr-mark)"
              opacity={0.045}
            />
          ) : null
        )}
        {[20, 30, 60].map((distance) => (
          <line
            key={`yd-${distance}`}
            x1={x(distance)}
            x2={x(distance)}
            y1={8}
            y2={height - 16}
            stroke={FAINT}
            strokeWidth={0.5}
            opacity={0.45}
          />
        ))}
        {/* The goalposts: crossbar and two uprights, at the end the kicks are
            aimed at. */}
        <g className="dr-kick-posts" aria-hidden="true">
          <line
            x1={PAD_LEFT - 26}
            x2={PAD_LEFT - 26}
            y1={10}
            y2={height - 16}
            stroke={INK}
            strokeWidth={2.25}
            opacity={0.55}
          />
          <line
            x1={PAD_LEFT - 34}
            x2={PAD_LEFT - 18}
            y1={10}
            y2={10}
            stroke={INK}
            strokeWidth={2.25}
            opacity={0.55}
          />
          <line
            x1={PAD_LEFT - 34}
            x2={PAD_LEFT - 34}
            y1={4}
            y2={10}
            stroke={INK}
            strokeWidth={2}
            opacity={0.55}
          />
          <line
            x1={PAD_LEFT - 18}
            x2={PAD_LEFT - 18}
            y1={4}
            y2={10}
            stroke={INK}
            strokeWidth={2}
            opacity={0.55}
          />
        </g>
        {[40, 50].map((distance) => (
          <line
            key={distance}
            x1={x(distance)}
            x2={x(distance)}
            y1={8}
            y2={height - 16}
            stroke={FAINT}
            strokeWidth={0.75}
            strokeDasharray="2 3"
            opacity={0.8}
          />
        ))}
        {/* One row a week; a week he did not kick is a dimmer rule. */}
        {Array.from({ length: WEEKS }, (_, index) => {
          const week = index + 1;
          const game = byWeek.get(week);
          return (
            <g key={week}>
              <line
                x1={PAD_LEFT}
                x2={PAD_LEFT + plot}
                y1={y(week)}
                y2={y(week)}
                stroke={TRACK}
                strokeWidth={1}
                opacity={game ? 1 : 0.5}
              />
              <text x={PAD_LEFT - 44} y={y(week) + 3} className="dr-kick-week" textAnchor="end">
                {week}
              </text>
              {game && (
                <text
                  x={PAD_LEFT + plot + 10}
                  y={y(week) + 3}
                  className="dr-kick-pat"
                  data-short={game.patMade < game.patAtt ? '' : undefined}
                >
                  {game.patAtt > 0 ? `${game.patMade}/${game.patAtt} xp` : ''}
                </text>
              )}
            </g>
          );
        })}
        {marks.map((mark, index) => {
          const cx = x(mark.distance);
          const cy = y(mark.week);
          const lit = hover === mark;
          return (
            <g key={index} onMouseEnter={() => setHover(mark)} style={{ cursor: 'help' }}>
              {/* A generous silent target so a three-pixel mark can be pointed at. */}
              <circle cx={cx} cy={cy} r={5} fill="transparent" />
              {mark.result === 'made' && (
                <circle cx={cx} cy={cy} r={lit ? 4 : 3} fill={lit ? HOT : GOOD} opacity={0.95} />
              )}
              {mark.result === 'missed' && (
                <g stroke="var(--dr-bad)" strokeWidth={lit ? 2 : 1.5}>
                  <line x1={cx - 3} x2={cx + 3} y1={cy - 3} y2={cy + 3} />
                  <line x1={cx - 3} x2={cx + 3} y1={cy + 3} y2={cy - 3} />
                </g>
              )}
              {mark.result === 'blocked' && (
                <rect
                  x={cx - 3}
                  y={cy - 3}
                  width={6}
                  height={6}
                  transform={`rotate(45 ${cx} ${cy})`}
                  fill="none"
                  stroke={WARN}
                  strokeWidth={lit ? 2 : 1.25}
                />
              )}
            </g>
          );
        })}
        {/* The distance axis. */}
        {[20, 30, 40, 50, 60].map((distance) => (
          <text
            key={distance}
            x={x(distance)}
            y={height - 3}
            className="dr-kick-axis"
            textAnchor="middle"
          >
            {distance}
          </text>
        ))}
        <text x={PAD_LEFT + plot} y={height - 3} className="dr-kick-axis" textAnchor="end">
          yds
        </text>
      </svg>

      {/* Fixed height, so pointing at the spray does not move the spray. */}
      <p className="dr-kick-read">
        {hover ? (
          <>
            Week {hover.week} · <b className="dr-num">{hover.distance}</b> yards ·{' '}
            <b data-result={hover.result}>{hover.result}</b>
            {hover.distance >= kicker.long && hover.result === 'made' && ' — his longest'}
          </>
        ) : (
          resting
        )}
      </p>

      {/* Accuracy by distance, his bar against the league's tick. Read per
          bucket because a rate over everything hides the only thing that
          separates kickers: whether the fifties go in. */}
      <div className="dr-kick-buckets">
        {buckets.map((bucket, index) => {
          const rate = bucket.attempts > 0 ? bucket.made / bucket.attempts : null;
          const ref = league[index]?.rate ?? null;
          return (
            <div
              className="dr-kick-bucket"
              key={bucket.label}
              title={
                rate == null
                  ? `No attempts from ${bucket.label}`
                  : `${bucket.made} of ${bucket.attempts} from ${bucket.label}${ref != null ? ` — the league makes ${Math.round(ref * 100)}%` : ''}`
              }
            >
              <span className="dr-kick-bucket-bar">
                <span
                  style={{
                    height: `${Math.round((rate ?? 0) * 100)}%`,
                    background:
                      rate == null ? 'transparent' : ref != null && rate < ref - 0.05 ? WARN : GOOD,
                  }}
                />
                {ref != null && <i style={{ bottom: `${Math.round(ref * 100)}%` }} />}
              </span>
              <b className="dr-num">{rate == null ? '—' : `${Math.round(rate * 100)}%`}</b>
              <em>{bucket.label}</em>
              <small className="dr-num">
                {bucket.made}/{bucket.attempts}
              </small>
            </div>
          );
        })}
        <div className="dr-kick-bucket dr-kick-bucket-key" aria-hidden="true">
          <span>
            <i className="is-made" /> made
          </span>
          <span>
            <i className="is-missed" /> missed
          </span>
          <span>
            <i className="is-blocked" /> blocked
          </span>
          <span>
            <i className="is-ref" style={{ background: INK }} /> league
          </span>
        </div>
      </div>
    </div>
  );
};
