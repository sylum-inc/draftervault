import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { DraftAnalytics, Player } from '@/services/auctionDraftService';
import {
  getIdentity,
  loadDefenseUnits,
  teamColors,
  teamLogo,
  type DefenseUnits,
} from '@/services/nflIdentity';
import {
  loadCareer,
  loadPlayerHistory,
  type CareerSeason,
  type PlayerSeason,
} from '@/services/playerHistory';
import { loadSchedule } from '@/services/nflSchedule';
import { Headshot } from './Headshot';
import { accentFor } from '@/lib/accent';
import { PercentileBars } from './charts/PercentileBars';
import { GameLog } from './charts/micro';
import { positionNorm } from '@/lib/positionNorms';
import { SeasonMultiples } from './charts/SeasonMultiples';
import { ScheduleStrip, type ScheduleGame } from './charts/ScheduleStrip';
import { BidLadder } from './charts/BidLadder';
import { PositionSwarm, type SwarmPoint } from './charts/PositionSwarm';
import { OutcomeCurve } from './charts/OutcomeCurve';
import { ConsensusRange } from './charts/ConsensusRange';
import { QuadrantScatter, type ScatterPoint } from './charts/QuadrantScatter';
import { CareerArc } from './charts/CareerArc';
import { ResearchPanel } from './ResearchPanel';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';

interface PlayerProfileProps {
  player: Player;
  analytics: DraftAnalytics | null;
  /** What is typed into the bid box right now, so the ladder can show it. */
  currentBid?: number;
  /** Points a freely available player at this position scores. */
  replacementPoints?: number;
  /** The rest of the pool, so a player can be shown inside his own position. */
  players?: Player[];
  replacement?: number | null;
  pinned?: boolean;
  onTogglePin?: () => void;
  onClose: () => void;
  /**
   * Rendered inside the board rather than over it.
   *
   * The same dossier either way — one set of tabs, one set of panels, one place
   * a number is decided — with only the chrome around it differing. A second
   * component for the expanded card would be a second answer to what a player's
   * detail *is*, and the two would drift the first time a tab was added to one
   * of them.
   */
  inline?: boolean;
}

type Tab =
  | 'overview'
  | 'production'
  | 'usage'
  | 'context'
  | 'career'
  | 'schedule'
  | 'value'
  | 'defense'
  | 'research';

/** 1st, 2nd, 3rd, 4th — the teens are the exception that catches everyone. */
const ordinal = (value: number): string => {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`;
};

const money = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `$${Math.round(value)}` : '—';

const statColumns = (position: string): Array<[string, (season: PlayerSeason) => string]> => {
  if (position === 'QB') {
    return [
      ['Pass yds', (s) => `${s.passingYards}`],
      ['Pass TD', (s) => `${s.passingTds}`],
      ['Int', (s) => `${s.interceptions}`],
      ['Rush yds', (s) => `${s.rushingYards}`],
    ];
  }
  if (position === 'RB') {
    return [
      ['Carries', (s) => `${s.carries}`],
      ['Rush yds', (s) => `${s.rushingYards}`],
      ['Rec', (s) => `${s.receptions}`],
      ['TD', (s) => `${s.rushingTds + s.receivingTds}`],
    ];
  }
  return [
    ['Targets', (s) => `${s.targets}`],
    ['Rec', (s) => `${s.receptions}`],
    ['Yds', (s) => `${s.receivingYards}`],
    ['Tgt share', (s) => (s.targetShare != null ? `${s.targetShare}%` : '—')],
  ];
};

/** One sentence on what this player is, assembled from what we actually know. */
const verdict = (player: Player): string => {
  const parts: string[] = [];
  const percentile = player.percentiles?.points;
  if (percentile != null) {
    parts.push(
      percentile >= 90
        ? `A top-ten ${player.position} by our projection`
        : percentile >= 70
          ? `An every-week starter at ${player.position}`
          : percentile >= 40
            ? `A flex-and-bye-week ${player.position}`
            : `Depth at ${player.position}`
    );
  }
  if (player.recentTrends === 'RISING') parts.push('scoring more than last season');
  if (player.recentTrends === 'DECLINING') parts.push('scoring less than last season');
  if (player.injuryRisk === 'HIGH') parts.push('with real availability risk');
  else if ((player.consistency ?? 0) >= 8) parts.push('and unusually steady week to week');
  if (player.competitionLevel === 'COMMITTEE') parts.push('sharing the workload');
  return `${parts.join(', ')}.`;
};

export const PlayerProfile = ({
  player,
  analytics,
  currentBid,
  replacementPoints,
  players = [],
  replacement = null,
  pinned = false,
  onTogglePin,
  onClose,
  inline = false,
}: PlayerProfileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [history, setHistory] = useState<PlayerSeason[] | null>(null);
  const [defense, setDefense] = useState<DefenseUnits | null>(null);
  const [schedule, setSchedule] = useState<ScheduleGame[] | null>(null);
  const [career, setCareer] = useState<CareerSeason[] | null>(null);

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);
  const isDefense = player.position === 'DST';

  const tabs: Array<[Tab, string]> = isDefense
    ? [
        ['overview', 'Overview'],
        ['defense', 'Unit'],
        ['schedule', 'Schedule'],
        ['value', 'Value'],
        ['research', 'Research'],
      ]
    : [
        ['overview', 'Overview'],
        ['production', 'Production'],
        ['usage', 'Usage'],
        ['context', 'Offence'],
        ['career', 'Career'],
        ['schedule', 'Schedule'],
        ['value', 'Value'],
        ['research', 'Research'],
      ];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useDismissOnEscape(onClose);

  // Each of these lives in its own lazily loaded file, fetched the first time a
  // tab needs it so opening a profile never waits on data nobody looks at.
  useEffect(() => {
    let live = true;
    if (isDefense) void loadDefenseUnits(team).then((units) => live && setDefense(units ?? null));
    else {
      void loadPlayerHistory(player.id).then((seasons) => live && setHistory(seasons));
      void loadCareer(player.id).then((seasons) => live && setCareer(seasons));
    }
    void loadSchedule(team).then((games) => live && setSchedule(games));
    return () => {
      live = false;
    };
  }, [player.id, team, isDefense]);

  const latest = history?.[history.length - 1];
  const columns = statColumns(player.position);

  /*
   * Where he stands among the men who actually start at his position.
   *
   * These read `player.percentiles` first, which the pool computes over every
   * player it holds — and the pool is six hundred and twenty-eight people, most
   * of them depth. Against that field every player worth opening a profile on
   * scores in the high nineties, so the panel drew seven full bars and said
   * nothing: projected points 100th, ceiling 100th, floor 99th. A reading that
   * is the same for everybody you would look at is not a reading.
   *
   * The cohort is the startable half instead — the players at his position who
   * beat replacement level, which is exactly the set he is competing with for a
   * roster spot and the same principle the board's own instruments were fixed
   * on. Replacement is already in hand here, so this needs nothing the panel
   * did not have.
   */
  const percentileRows = useMemo(() => {
    const bar = replacement ?? replacementPoints ?? null;
    const field = players.filter(
      (other) =>
        other.position === player.position &&
        !other.marketOnly &&
        (bar == null || other.projectedPoints > bar)
    );

    const standing = (read: (entry: Player) => number | null | undefined): number | null => {
      const mine = read(player);
      if (mine == null || !Number.isFinite(mine)) return null;
      const values = field
        .map(read)
        .filter((value): value is number => value != null && Number.isFinite(value));
      // Below six the percentile is an accident of who happened to be measured,
      // which is the same floor `positionNorms` holds itself to.
      if (values.length < 6) return null;
      const below = values.filter((value) => value < mine).length;
      const equal = values.filter((value) => value === mine).length;
      // Midpoint for ties, so two identical players do not come out a rank
      // apart because of the order they were listed in.
      return Math.round(((below + equal / 2) / values.length) * 100);
    };

    const rows: Array<{ label: string; percentile: number; value: string }> = [];
    const add = (
      label: string,
      read: (entry: Player) => number | null | undefined,
      format: (value: number) => string
    ) => {
      const percentile = standing(read);
      const mine = read(player);
      if (percentile == null || mine == null) return;
      rows.push({ label, percentile, value: format(mine) });
    };

    add(
      'Projected points',
      (entry) => entry.projectedPoints,
      (value) => `${Math.round(value)}`
    );
    add(
      'Points per game',
      (entry) => entry.pointsPerGame,
      (value) => value.toFixed(1)
    );
    add(
      'Ceiling',
      (entry) => entry.upside,
      (value) => `${Math.round(value)}`
    );
    add(
      'Floor',
      (entry) => entry.floor,
      (value) => `${Math.round(value)}`
    );
    add(
      'Consistency',
      (entry) => entry.consistency,
      (value) => `${value}/10`
    );
    add(
      'Snap share',
      (entry) => entry.snapPercentage,
      (value) => `${Math.round(value)}%`
    );
    add(
      'Target share',
      (entry) => entry.usage?.targetShare,
      (value) => `${value}%`
    );
    add(
      'Red-zone touches',
      (entry) => entry.usage?.redZoneTouches,
      (value) => `${value}`
    );
    return rows;
  }, [player, players, replacement, replacementPoints]);

  // The player's own position, as points, so every distribution chart below is
  // drawn against the field he is actually competing with for a roster spot.
  const cohort = useMemo(
    () => players.filter((other) => other.position === player.position),
    [players, player.position]
  );

  const swarmOf = useMemo(
    () =>
      (read: (p: Player) => number | null | undefined): SwarmPoint[] =>
        cohort
          .map((other) => ({
            id: other.id,
            name: getIdentity(other.id)?.name ?? other.name,
            value: read(other) ?? Number.NaN,
          }))
          .filter((point) => Number.isFinite(point.value)),
    [cohort]
  );

  const opportunityScatter = useMemo<ScatterPoint[]>(
    () =>
      cohort
        .filter((other) => other.usage?.touchesPerGame != null && other.usage?.epaPerTouch != null)
        .map((other) => ({
          id: other.id,
          name: getIdentity(other.id)?.name ?? other.name,
          position: other.position,
          x: other.usage!.touchesPerGame!,
          y: other.usage!.epaPerTouch!,
          drafted: other.isDrafted,
        })),
    [cohort]
  );

  // Deliberately not price against points: our dollar value is a linear function
  // of VORP, which is a linear function of projected points, so that chart can
  // only ever draw a straight line and tells you nothing. The market's rank is
  // the independent axis — the gap between it and our projection is the signal.
  const priceScatter = useMemo<ScatterPoint[]>(
    () =>
      cohort
        .filter((other) => other.market?.consensusRank != null && other.estimatedValue > 1)
        .map((other) => ({
          id: other.id,
          name: getIdentity(other.id)?.name ?? other.name,
          position: other.position,
          x: other.market!.consensusRank!,
          y: other.projectedPoints,
          drafted: other.isDrafted,
        })),
    [cohort]
  );

  const body = (
    <>
      {/* The hero belongs to the modal. Inline, the card's own face is right
          there down the left with the name, the club and the price on it, so a
          second and larger copy of all three would be the panel introducing a
          player the reader is already looking at. */}
      {!inline && (
        <header className="dr-stage-hero">
          {logo && <img className="dr-stage-logo" src={logo} alt="" aria-hidden="true" />}
          {isDefense && logo ? (
            <img className="dr-stage-photo dr-crest-photo" src={logo} alt="" aria-hidden="true" />
          ) : (
            <Headshot
              identity={identity}
              fallbackName={player.name}
              width={208}
              className="dr-stage-photo"
            />
          )}
          <div>
            <h2 className="dr-stage-name">{identity?.name ?? player.name}</h2>
            <p className="dr-stage-sub">
              <span className="dr-pos">{player.position}</span>
              {team}
              {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
              {identity?.age && <span className="dr-num">{identity.age}y</span>}
              <span className="dr-num">#{player.adp} overall</span>
            </p>
          </div>
          {onTogglePin && (
            <button
              type="button"
              className={`dr-button dr-profile-pin${pinned ? ' is-primary' : ''}`}
              onClick={onTogglePin}
              aria-pressed={pinned}
            >
              {pinned ? 'Pinned' : 'Pin to compare'}
            </button>
          )}
          <button
            ref={closeRef}
            type="button"
            className="dr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
      )}

      <div className="dr-tabs" role="tablist" aria-label="Player detail">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className="dr-tab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {identity?.injury?.status && (
        <p className="dr-notice" style={{ margin: '12px 16px 0' }}>
          Injury report: {identity.injury.status}
          {identity.injury.detail ? ` — ${identity.injury.detail}` : ''}
        </p>
      )}

      {tab === 'overview' && (
        <div className="dr-tabpanel" role="tabpanel">
          <dl className="dr-stage-tiles dr-profile-tiles">
            <div className="dr-tile">
              <dt>Value</dt>
              <dd style={{ color: 'var(--dr-value)' }}>${player.estimatedValue}</dd>
            </div>
            <div className="dr-tile">
              <dt>Projected</dt>
              <dd>{player.projectedPoints}</dd>
            </div>
            <div className="dr-tile">
              <dt>VORP</dt>
              <dd>{player.valueOverReplacement}</dd>
            </div>
            <div className="dr-tile">
              <dt>Bye</dt>
              <dd>{player.byeWeek || '—'}</dd>
            </div>
          </dl>

          <p className="dr-verdict-line">{verdict(player)}</p>

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Likely season</h3>
            {/* The range bar that used to sit here printed floor, projection
                  and ceiling; the curve directly below it printed floor,
                  projection, ceiling and the share above replacement. Two
                  instruments, one of them a strict superset, stacked — and the
                  bar was the weaker claim besides, saying "somewhere in here"
                  with every point equally likely when the numbers are one
                  standard deviation either side of a mean. */}
            <OutcomeCurve
              projection={player.projectedPoints}
              floor={player.floor}
              ceiling={player.upside}
              replacement={replacement ?? replacementPoints ?? null}
            />
          </section>

          {cohort.length > 4 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Where he sits at {player.position}</h3>
              <PositionSwarm
                points={swarmOf((p) => p.projectedPoints)}
                highlightId={player.id}
                label="Projected points"
                position={player.position}
                reference={
                  replacement != null ? { value: replacement, label: 'replacement level' } : null
                }
              />
              <PositionSwarm
                points={swarmOf((p) => p.estimatedValue)}
                highlightId={player.id}
                label="Auction value"
                position={player.position}
                format={(value) => `$${Math.round(value)}`}
              />
            </section>
          )}

          {percentileRows.length > 0 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Against the position</h3>
              <PercentileBars rows={percentileRows} position={player.position} />
            </section>
          )}

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Risk</h3>
            <dl className="dr-facts">
              <div>
                <dt>Injury risk</dt>
                <dd>{player.injuryRisk}</dd>
              </div>
              <div>
                <dt>Age risk</dt>
                <dd>{player.ageRisk}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
              </div>
              <div>
                <dt>Trend</dt>
                <dd>{player.recentTrends.toLowerCase()}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {tab === 'production' && (
        <div className="dr-tabpanel" role="tabpanel">
          {history === null && <p className="dr-empty">Loading three seasons…</p>}
          {history?.length === 0 && (
            <p className="dr-empty">
              No regular-season tape in the last three years. The projection comes from what players
              drafted in the same round have historically produced.
            </p>
          )}

          {latest && latest.weekly.length > 1 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">{latest.season} season, game by game</h3>
              {/* The same instrument the board draws, at the size a profile
                    can afford. A line here and a game log there would be two
                    pictures of one season, and the line is the weaker of them:
                    it joins games that did not touch, it makes a nine-game year
                    the width of a seventeen-game one, and it has nothing to say
                    about which weeks were actually worth starting him. */}
              <GameLog
                weeks={latest.weekly}
                replacement={(replacement ?? replacementPoints ?? 0) / 17}
                strongWeek={(positionNorm(player.position, 'ppg')?.top ?? 10) * 2}
                label={`${player.name}: points in each ${latest.season} game against replacement level`}
                width={480}
                height={64}
              />
              <p className="dr-footnote">
                One column a Sunday, empty where he did not play. The dashed rule is what a freely
                available {player.position} scores per game — columns above it are weeks he beat the
                alternative.
              </p>
            </section>
          )}

          {history && history.length > 1 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Season on season</h3>
              <SeasonMultiples seasons={history} />
            </section>
          )}

          {history && history.length > 0 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Totals</h3>
              <div className="dr-table-wrap">
                <table className="dr-table dr-table-compact">
                  <thead>
                    <tr>
                      <th scope="col">Season</th>
                      <th scope="col" className="is-numeric">
                        Tm
                      </th>
                      <th scope="col" className="is-numeric">
                        G
                      </th>
                      <th scope="col" className="is-numeric">
                        PPG
                      </th>
                      <th scope="col" className="is-numeric">
                        Points
                      </th>
                      {columns.map(([label]) => (
                        <th key={label} scope="col" className="is-numeric">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((season) => (
                      <tr key={season.season}>
                        <td className="dr-num">{season.season}</td>
                        <td className="is-numeric">{season.team}</td>
                        <td className="is-numeric dr-num">{season.games}</td>
                        <td className="is-numeric dr-num" style={{ color: 'var(--dr-ink)' }}>
                          {season.pointsPerGame}
                        </td>
                        <td className="is-numeric dr-num">{Math.round(season.pprPoints)}</td>
                        {columns.map(([label, read]) => (
                          <td key={label} className="is-numeric dr-num">
                            {read(season)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'usage' && (
        <div className="dr-tabpanel" role="tabpanel">
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">How he is used</h3>
            <dl className="dr-facts">
              <div>
                <dt>Snap share</dt>
                <dd>
                  {player.snapPercentage != null ? `${Math.round(player.snapPercentage)}%` : '—'}
                </dd>
              </div>
              <div>
                <dt>Target share</dt>
                <dd>{player.usage?.targetShare != null ? `${player.usage.targetShare}%` : '—'}</dd>
              </div>
              <div>
                <dt>Carry share</dt>
                <dd>{player.usage?.carryShare != null ? `${player.usage.carryShare}%` : '—'}</dd>
              </div>
              <div>
                <dt>Games played</dt>
                <dd>{player.usage?.games ?? player.lastSeasonGames ?? '—'}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
              </div>
            </dl>
          </section>

          {player.usage && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Opportunity, {player.usage.season}</h3>
              <dl className="dr-facts">
                <div>
                  <dt title="Weighted opportunity: targets and air yards in the proportion that predicts receiving points">
                    WOPR
                  </dt>
                  <dd>{player.usage.wopr ?? '—'}</dd>
                </div>
                <div>
                  <dt title="Average depth of target">aDOT</dt>
                  <dd>{player.usage.adot != null ? `${player.usage.adot} yd` : '—'}</dd>
                </div>
                <div>
                  <dt>Air yards share</dt>
                  <dd>
                    {player.usage.airYardsShare != null ? `${player.usage.airYardsShare}%` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>YAC per catch</dt>
                  <dd>
                    {player.usage.yacPerReception != null
                      ? `${player.usage.yacPerReception} yd`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Touches per game</dt>
                  <dd>{player.usage.touchesPerGame ?? '—'}</dd>
                </div>
                <div>
                  <dt>First downs per game</dt>
                  <dd>{player.usage.firstDownsPerGame ?? '—'}</dd>
                </div>
                <div>
                  <dt title="Expected points added per touch">EPA per touch</dt>
                  <dd>{player.usage.epaPerTouch ?? '—'}</dd>
                </div>
                <div>
                  <dt>Red-zone touches</dt>
                  <dd>
                    {player.usage.redZoneTouches}
                    {player.usage.redZoneShare != null && (
                      <span className="dr-facts-note"> · {player.usage.redZoneShare}% of team</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt title="Inside the five-yard line, where touchdowns are decided">
                    Goal-line touches
                  </dt>
                  <dd>{player.usage.goalLineTouches}</dd>
                </div>
              </dl>
              <p className="dr-footnote">
                Shares are of his own team's volume. Red-zone and goal-line counts come from the
                play-by-play, so they are touches that actually happened inside the twenty and the
                five.
              </p>
            </section>
          )}

          {cohort.length > 4 && player.usage?.redZoneTouches != null && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Red-zone work across {player.position}s</h3>
              <PositionSwarm
                points={swarmOf((p) => p.usage?.redZoneTouches)}
                highlightId={player.id}
                label="Red-zone touches"
                position={player.position}
              />
            </section>
          )}

          {opportunityScatter.length > 6 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Volume against efficiency</h3>
              <QuadrantScatter
                points={opportunityScatter}
                xLabel="Touches per game"
                yLabel="EPA per touch"
                quadrants={['Feature back', 'Volume, little else', 'Fringe', 'Efficient, starved']}
                highlightId={player.id}
                formatX={(value) => value.toFixed(1)}
                formatY={(value) => value.toFixed(3)}
              />
              <p className="dr-footnote">
                The top-right corner is a player who gets the ball a lot and does something with it.
                The top-left is the one to watch: efficient on a role that could grow.
              </p>
            </section>
          )}

          {latest && (latest.airYards > 0 || latest.yardsAfterCatch > 0) && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Where the yards come from</h3>
              <div className="dr-split">
                <span
                  className="dr-split-part"
                  style={{
                    width: `${(latest.airYards / Math.max(1, latest.airYards + latest.yardsAfterCatch)) * 100}%`,
                  }}
                >
                  <em>Air</em>
                  <strong className="dr-num">{latest.airYards}</strong>
                </span>
                <span className="dr-split-part is-secondary">
                  <em>After catch</em>
                  <strong className="dr-num">{latest.yardsAfterCatch}</strong>
                </span>
              </div>
              <p className="dr-footnote">
                Air yards are earned before the ball arrives and depend on how a team uses him;
                yards after the catch are his own.
              </p>
            </section>
          )}

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Background</h3>
            <dl className="dr-facts">
              <div>
                <dt>Age</dt>
                <dd>{identity?.age ?? '—'}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{identity?.experience != null ? `${identity.experience} yr` : '—'}</dd>
              </div>
              <div>
                <dt>College</dt>
                <dd>{identity?.college ?? '—'}</dd>
              </div>
              <div>
                <dt>Games missed</dt>
                <dd>
                  {player.injuryRisk === 'LOW' ? 'few or none' : player.injuryRisk.toLowerCase()}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {tab === 'context' && (
        <div className="dr-tabpanel" role="tabpanel">
          {player.teamContext ? (
            <>
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">The {team} offence, 2025</h3>
                <dl className="dr-facts">
                  <div>
                    <dt>Plays per game</dt>
                    <dd>{player.teamContext.playsPerGame}</dd>
                  </div>
                  <div>
                    <dt title="Seconds between snaps inside a drive — lower is faster">
                      Seconds per play
                    </dt>
                    <dd>{player.teamContext.secondsPerPlay ?? '—'}</dd>
                  </div>
                  <div>
                    <dt title="Pass rate with the game within a score, through three quarters">
                      Neutral pass rate
                    </dt>
                    <dd>
                      {player.teamContext.neutralPassRate != null
                        ? `${player.teamContext.neutralPassRate}%`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt title="How much more they throw than the situations call for">
                      Pass rate over expected
                    </dt>
                    <dd>
                      {player.teamContext.passRateOverExpected != null
                        ? `${player.teamContext.passRateOverExpected > 0 ? '+' : ''}${player.teamContext.passRateOverExpected}%`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt title="Sacks per dropback — the cleanest free read on pass protection">
                      Sack rate allowed
                    </dt>
                    <dd>
                      {player.teamContext.sackRateAllowed != null
                        ? `${player.teamContext.sackRateAllowed}%`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Red-zone trips per game</dt>
                    <dd>{player.teamContext.redZoneTripsPerGame}</dd>
                  </div>
                  <div>
                    <dt title="Expected points added per offensive play">EPA per play</dt>
                    <dd>{player.teamContext.epaPerPlay ?? '—'}</dd>
                  </div>
                </dl>
                <p className="dr-footnote">
                  Opportunity is granted by a team before it is earned by a player: the same target
                  share is worth more on an offence running 68 plays a game than 58. Everything here
                  is computed from the 2025 play-by-play.
                </p>
              </section>

              {player.competition && (
                <section className="dr-modal-section">
                  <h3 className="dr-eyebrow">Competition for the job</h3>
                  <dl className="dr-facts">
                    <div>
                      <dt>Depth chart</dt>
                      <dd>
                        {player.competition.depth} of {player.competition.roomSize} at{' '}
                        {player.position}
                      </dd>
                    </div>
                    <div>
                      <dt>Next man up</dt>
                      <dd>{player.competition.nextUp ?? '—'}</dd>
                    </div>
                    <div>
                      <dt title="Points per game between him and the player behind him">
                        Clear by
                      </dt>
                      <dd>
                        {player.competition.aheadBy != null
                          ? `${player.competition.aheadBy} ppg`
                          : '—'}
                      </dd>
                    </div>
                    {player.competition.starterAhead && (
                      <div>
                        <dt>Behind</dt>
                        <dd>
                          {player.competition.starterAhead}
                          {player.competition.behindBy != null && (
                            <span className="dr-facts-note">
                              {' '}
                              · by {player.competition.behindBy} ppg
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="dr-footnote">
                    Ordered by our own projection among his listed teammates, so a narrow gap is a
                    job that could change hands.
                  </p>
                </section>
              )}
            </>
          ) : (
            <p className="dr-empty">No play-by-play for this team's 2025 offence.</p>
          )}
        </div>
      )}

      {tab === 'career' && (
        <div className="dr-tabpanel" role="tabpanel">
          {career === null && <p className="dr-empty">Loading the career…</p>}
          {career?.length === 0 && (
            <p className="dr-empty">
              No regular-season games yet — the projection is drawn from draft capital and what
              players picked in the same round have produced.
            </p>
          )}

          {career && career.length > 1 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">
                {career[0].season}–{career[career.length - 1].season}
              </h3>
              <CareerArc seasons={career} missed={player.durability?.seasons} />
            </section>
          )}

          {player.durability && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Durability</h3>
              <dl className="dr-facts">
                <div>
                  <dt>Games missed, three seasons</dt>
                  <dd>{player.durability.totalMissed}</dd>
                </div>
                {player.durability.seasons.map((row) => (
                  <div key={row.season}>
                    <dt>{row.season}</dt>
                    <dd>{row.missed === 0 ? 'none' : `${row.missed} missed`}</dd>
                  </div>
                ))}
              </dl>
              {player.durability.reported.length > 0 && (
                <>
                  <p className="dr-facts-list">
                    Treated for{' '}
                    {player.durability.reported
                      .map((row) => `${row.part.toLowerCase()} (${row.weeks} weeks listed)`)
                      .join(', ')}
                    .
                  </p>
                  <p className="dr-footnote">
                    Weeks on the injury report, which is not the same as games missed — a player can
                    be listed all season and start every game.
                  </p>
                </>
              )}
            </section>
          )}

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Background</h3>
            <dl className="dr-facts">
              <div>
                <dt>Age</dt>
                <dd>{identity?.age ?? player.age ?? '—'}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{identity?.experience != null ? `${identity.experience} yr` : '—'}</dd>
              </div>
              <div>
                <dt>College</dt>
                <dd>{identity?.college ?? '—'}</dd>
              </div>
              {player.draftCapital && (
                <div>
                  <dt>Drafted</dt>
                  <dd>
                    {player.draftCapital.year} · round {player.draftCapital.round}, pick{' '}
                    {player.draftCapital.pick}
                  </dd>
                </div>
              )}
              {player.breakoutSeason && (
                <div>
                  <dt title="First season averaging 12 points a game over at least eight games">
                    Broke out
                  </dt>
                  <dd>{player.breakoutSeason}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="dr-tabpanel" role="tabpanel">
          {schedule === null && <p className="dr-empty">Loading the season…</p>}
          {schedule && schedule.length === 0 && (
            <p className="dr-empty">No schedule published yet.</p>
          )}
          {schedule && schedule.length > 0 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">{team} season</h3>
              <ScheduleStrip games={schedule} byeWeek={player.byeWeek ?? null} />
            </section>
          )}
        </div>
      )}

      {tab === 'defense' && (
        <div className="dr-tabpanel" role="tabpanel">
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">2025 defensive production</h3>
            <dl className="dr-facts">
              <div>
                <dt>Sacks</dt>
                <dd>{player.defense?.sacks ?? '—'}</dd>
              </div>
              <div>
                <dt>Interceptions</dt>
                <dd>{player.defense?.interceptions ?? '—'}</dd>
              </div>
              <div>
                <dt>Fumbles recovered</dt>
                <dd>{player.defense?.fumbleRecoveries ?? '—'}</dd>
              </div>
              <div>
                <dt>Touchdowns</dt>
                <dd>{player.defense?.touchdowns ?? '—'}</dd>
              </div>
              <div>
                <dt>Points allowed / game</dt>
                <dd>{player.defense?.pointsAllowedPerGame ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Defensive personnel</h3>
            {defense === null && <p className="dr-empty">Loading the unit…</p>}
            {defense && (
              <div className="dr-units">
                {(
                  [
                    ['Line', defense.dl],
                    ['Linebackers', defense.lb],
                    ['Secondary', defense.db],
                  ] as const
                ).map(([label, unit]) => (
                  <div className="dr-unit" key={label}>
                    <h4 className="dr-eyebrow">{label}</h4>
                    <ul>
                      {unit.map((person) => (
                        <li key={person.espnId}>
                          <span className="dr-unit-pos dr-num">{person.position}</span>
                          {person.name}
                          {person.jersey && (
                            <span className="dr-unit-jersey dr-num">#{person.jersey}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <p className="dr-footnote">
              Personnel come from the current ESPN roster, ordered by jersey number — which stands
              in for a depth chart the feed does not publish.
            </p>
          </section>
        </div>
      )}

      {tab === 'value' && (
        <div className="dr-tabpanel" role="tabpanel">
          {analytics && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">What to bid</h3>
              <BidLadder
                openingBid={Math.round(analytics.openingBid)}
                targetBid={Math.round(analytics.targetBid)}
                maxBid={Math.round(analytics.maxBid)}
                walkAway={Math.round(analytics.walkAwayPoint)}
                currentBid={currentBid}
              />
            </section>
          )}

          {player.market?.consensusRank != null &&
            player.market.best != null &&
            player.market.worst != null && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">What the room thinks</h3>
                {/* `ourRank` is `modelRank` and not `adp`. `adp` is the
                      rank in force, so after "Use consensus" this read "our
                      board #21" beside "consensus #14" — a gap between two
                      market signals, printed as our disagreement with the
                      room. */}
                <ConsensusRange
                  consensus={player.market.consensusRank}
                  best={player.market.best}
                  worst={player.market.worst}
                  ourRank={player.modelRank}
                  spread={player.market.spread}
                  asOf={player.market.asOf}
                  source={player.market.source}
                />
                {player.market.ownership != null && (
                  <p className="dr-footnote">
                    Rostered in {player.market.ownership}% of leagues.
                    {player.market.searchRank != null &&
                      ` Sleeper has him the ${ordinal(player.market.searchRank)} most looked-up.`}
                  </p>
                )}
              </section>
            )}

          {priceScatter.length > 6 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Our projection against where the room drafts him</h3>
              <QuadrantScatter
                points={priceScatter}
                xLabel="Consensus rank (later →)"
                yLabel="Projected points"
                quadrants={['Ours alone', 'Rightly ignored', 'Room overrates', 'Consensus star']}
                highlightId={player.id}
                formatX={(value) => `#${Math.round(value)}`}
              />
              <p className="dr-footnote">
                The top-right corner is the one to hunt: players we project well who the room drafts
                late. Faded dots are already gone. Deliberately not price against points — our
                dollar value is derived from the projection, so that chart is a straight line by
                construction.
              </p>
            </section>
          )}

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">How the price was reached</h3>
            <dl className="dr-facts">
              <div>
                <dt>List value</dt>
                <dd>${player.estimatedValue}</dd>
              </div>
              <div>
                <dt>Value over replacement</dt>
                <dd>{player.valueOverReplacement} pts</dd>
              </div>
              <div>
                <dt>Market inflation</dt>
                <dd>{analytics ? `${analytics.marketInflation}×` : '—'}</dd>
              </div>
              <div>
                <dt>Position gone</dt>
                <dd>{analytics ? `${Math.round(analytics.positionScarcity * 100)}%` : '—'}</dd>
              </div>
              <div>
                <dt>Your need</dt>
                <dd>{analytics ? `${analytics.needMultiplier}×` : '—'}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{analytics ? `${analytics.confidenceLevel}%` : '—'}</dd>
              </div>
              <div>
                <dt>Adjusted value</dt>
                <dd>{money(analytics?.adjustedValue)}</dd>
              </div>
              <div>
                <dt>Tier</dt>
                <dd>{player.tier}</dd>
              </div>
            </dl>
            <p className="dr-footnote">
              List value is value over replacement turned into a share of the league's budget.
              Inflation, scarcity and need move it as the draft runs — confidence is how much of
              this player we have actually seen play.
            </p>
          </section>
        </div>
      )}

      {tab === 'research' && <ResearchPanel playerId={player.id} playerName={player.name} />}
    </>
  );

  const accent = {
    '--dr-accent': primary,
    '--dr-accent-lift': accentFor(primary),
  } as CSSProperties;

  // Expanded in place on the board: no scrim, no dialog role, and it spans the
  // grid so the card genuinely grows rather than something appearing over it.
  if (inline) {
    return (
      <div className="dr-profile dr-profile-inline" style={accent}>
        {body}
      </div>
    );
  }

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label={`${player.name} profile`}>
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close profile"
        onClick={onClose}
      />
      <article className="dr-modal-panel dr-profile" style={accent}>
        {body}
      </article>
    </div>
  );
};
