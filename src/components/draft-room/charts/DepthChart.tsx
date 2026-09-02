import { useState } from 'react';
import type { DefenseUnits, PlayerIdentity } from '@/services/nflIdentity';
import { FAINT, GOOD, INK, TRACK, WARN } from './micro';

/**
 * The unit on the field, rather than three lists of names.
 *
 * A depth chart is a picture before it is a table: four down, three behind,
 * two wide, two deep. Drawn that way the questions a drafter has about a
 * defence answer themselves — is the line the strength or the secondary, how
 * green is the back seven, who is the body behind the body. Every mark is a
 * player; pointing at one names him, with his age, his years and his size,
 * and the row under the field is the men who come on when somebody goes off.
 *
 * The feed publishes no depth order, so the order it does publish — jersey —
 * stands in for one, as the list it replaces already admitted. First bodies
 * start; the rest are depth.
 */
interface DepthChartProps {
  units: DefenseUnits;
  label: string;
  width?: number;
}

type Body = PlayerIdentity;

const inches = (value: number | null) =>
  value == null ? '' : `${Math.floor(value / 12)}′${value % 12}″`;

const describe = (body: Body) =>
  [
    `${body.name} · ${body.position}${body.jersey ? ` #${body.jersey}` : ''}`,
    [
      body.age != null ? `${body.age}y` : null,
      body.experience != null
        ? `${body.experience === 0 ? 'rookie' : `${body.experience}th yr`}`
        : null,
    ]
      .filter(Boolean)
      .join(', '),
    [inches(body.heightInches), body.weightPounds != null ? `${body.weightPounds} lb` : null]
      .filter(Boolean)
      .join(' '),
    body.college ?? '',
  ]
    .filter(Boolean)
    .join(' · ');

/* The surname, without a generational suffix: "Derick Hall II" is Hall, not II. */
const surname = (name: string) => {
  const parts = name.split(' ').filter((part) => !/^(II|III|IV|V|Jr\.?|Sr\.?)$/i.test(part));
  return parts[parts.length - 1] ?? name;
};

/* Which of the secondary play corner and which play safety, off the position
   the roster gives. Anything unlabelled falls to the corners first. */
const isSafety = (body: Body) => /^(S|FS|SS)$/.test(body.position);

export const DepthChart = ({ units, label, width = 440 }: DepthChartProps) => {
  const [hover, setHover] = useState<Body | null>(null);
  const height = 250;
  const cx = width / 2;

  const line = units.dl;
  const backers = units.lb;
  const corners = units.db.filter((body) => !isSafety(body));
  const safeties = units.db.filter(isSafety);

  const starters = {
    dl: line.slice(0, 4),
    lb: backers.slice(0, 3),
    cb: corners.slice(0, 2),
    s: safeties.slice(0, 2),
  };
  const depth = [...line.slice(4), ...backers.slice(3), ...corners.slice(2), ...safeties.slice(2)];

  const spread = (count: number, span: number, y: number) =>
    Array.from({ length: count }, (_, index) => ({
      x: cx + (index - (count - 1) / 2) * span,
      y,
    }));

  const seats: Array<{ body: Body; x: number; y: number; r: number; starter: boolean }> = [];
  spread(starters.dl.length, 64, 74).forEach((p, i) =>
    seats.push({ body: starters.dl[i], ...p, r: 15, starter: true })
  );
  spread(starters.lb.length, 84, 128).forEach((p, i) =>
    seats.push({ body: starters.lb[i], ...p, r: 15, starter: true })
  );
  [42, width - 42]
    .slice(0, starters.cb.length)
    .forEach((x, i) => seats.push({ body: starters.cb[i], x, y: 74, r: 15, starter: true }));
  spread(starters.s.length, 150, 186).forEach((p, i) =>
    seats.push({ body: starters.s[i], ...p, r: 15, starter: true })
  );
  const bench = depth.slice(0, Math.floor((width - 40) / 30));
  bench.forEach((body, i) =>
    seats.push({ body, x: 22 + i * 30 + 14, y: height - 18, r: 10, starter: false })
  );

  const young = (body: Body) => body.experience != null && body.experience <= 1;

  return (
    <div className="dr-depth">
      <svg
        className="dr-depth-field"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        {/* The line of scrimmage, and the field behind it. */}
        <rect
          x={0.5}
          y={0.5}
          width={width - 1}
          height={height - 44}
          rx={4}
          fill={TRACK}
          opacity={0.35}
        />
        <line x1={12} x2={width - 12} y1={48} y2={48} stroke={INK} strokeWidth={1} opacity={0.35} />
        <text x={16} y={42} className="dr-depth-mark">
          line of scrimmage
        </text>
        <line
          x1={12}
          x2={width - 12}
          y1={height - 40}
          y2={height - 40}
          stroke={FAINT}
          strokeWidth={0.75}
          strokeDasharray="2 3"
        />
        <text x={16} y={height - 30} className="dr-depth-mark">
          depth
        </text>

        {seats.map(({ body, x, y, r, starter }) => {
          const lit = hover?.espnId === body.espnId;
          return (
            <g
              key={`${body.espnId}-${x}-${y}`}
              onMouseEnter={() => setHover(body)}
              style={{ cursor: 'help' }}
            >
              <circle cx={x} cy={y} r={r + 4} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={lit ? INK : starter ? 'var(--dr-surface-2)' : 'var(--dr-surface)'}
                stroke={lit ? INK : young(body) ? WARN : GOOD}
                strokeWidth={lit ? 2 : starter ? 1.5 : 1}
                opacity={starter ? 1 : 0.85}
              />
              <text
                x={x}
                y={y + (r > 12 ? 4 : 3)}
                className={r > 12 ? 'dr-depth-num' : 'dr-depth-num is-small'}
                textAnchor="middle"
                fill={lit ? 'var(--dr-ground)' : INK}
              >
                {body.jersey ?? body.position}
              </text>
              {starter && (
                <text x={x} y={y + r + 11} className="dr-depth-name" textAnchor="middle">
                  {surname(body.name)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="dr-kick-read">
        {hover
          ? describe(hover)
          : `${line.length} on the line, ${backers.length} backers, ${corners.length} corners, ${safeties.length} safeties. Amber rings are first- and second-year players.`}
      </p>
    </div>
  );
};
