import type { ReactNode } from 'react';
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
  seasonShape,
  type CareerSeason,
  type PlayerSeason,
} from '@/services/playerHistory';
import { loadSchedule, teamSchedule } from '@/services/nflSchedule';
import { Headshot } from './Headshot';
import { accentFor } from '@/lib/accent';
import {
  CatchDepth,
  DepthLadder,
  GameLog,
  GoalLine,
  PlayMix,
  RoleField,
  Seasons,
} from './charts/micro';
import {
  BidScrub,
  MetricStrip,
  PriceChain,
  ScoringMix,
  Threshold,
  WeeksAbove,
  type MixSeason,
  type StripPoint,
} from './charts/profile';
import { offenceNorm, positionNorm } from '@/lib/positionNorms';
import { modelCaveats } from '@/lib/modelTrust';
import { pointsFor, type LeagueShape } from '@/lib/valuation';
import { ScheduleStrip, type ScheduleGame } from './charts/ScheduleStrip';
import { PositionSwarm, type SwarmPoint } from './charts/PositionSwarm';
import { OutcomeCurve } from './charts/OutcomeCurve';
import { ConsensusRange } from './charts/ConsensusRange';
import { QuadrantScatter, type ScatterPoint } from './charts/QuadrantScatter';
import { CareerArc } from './charts/CareerArc';
import { ResearchPanel } from './ResearchPanel';
import { KickChart } from './charts/KickChart';
import { DepthChart } from './charts/DepthChart';
import {
  loadKicking,
  leagueBuckets,
  kickPoints,
  kickerSummaries,
  type KickingFile,
} from '@/services/kicking';
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
  /**
   * The league being played, so a season's points are restated the way every
   * other number here already is.
   *
   * The totals table and the scoring mix both read `pprPoints`, which is the
   * full-PPR figure nflverse scores — printing that beside a half-PPR
   * projection is the quiet drift `valuation.ts` exists to prevent, one
   * register out. Restated through the same `pointsFor` the pool builder and
   * the board come through, so there is no second definition of what a catch
   * is worth.
   */
  league?: LeagueShape | null;
  /** Points a bid buys over the man the snake hands you free, if knowable. */
  gain?: number | null;
  gainFree?: string | null;
  /** The most the owner's team may legally bid, from the engine. */
  ceiling?: number | null;
  /** The plan's walk-away for him, when a plan can be computed. */
  walkAway?: number | null;
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
  /**
   * The live half, when there is one.
   *
   * The spotlight hands in a rendered "Tonight" tab — what one bid on this
   * player does to *your* draft in the state the room is in right now — and it
   * goes first, because on the block that is the question being asked. The
   * raised card and the modal deliberately do not get one: they are about the
   * player, and the difference between the two surfaces is exactly this tab.
   */
  tonight?: ReactNode;
  /**
   * Whether Escape closes it. The spotlight says no: it is not a dialog, and a
   * keystroke that cleared the block mid-bid would be a keystroke that lost a
   * player.
   */
  escapable?: boolean;
}

type Tab =
  | 'tonight'
  | 'kicking'
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
  league = null,
  gain = null,
  gainFree = null,
  ceiling = null,
  walkAway = null,
  pinned = false,
  onTogglePin,
  onClose,
  inline = false,
  tonight,
  escapable = true,
}: PlayerProfileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>(tonight ? 'tonight' : 'overview');
  const [history, setHistory] = useState<PlayerSeason[] | null>(null);
  const [defense, setDefense] = useState<DefenseUnits | null>(null);
  const [schedule, setSchedule] = useState<ScheduleGame[] | null>(null);
  const [career, setCareer] = useState<CareerSeason[] | null>(null);
  const [kicking, setKicking] = useState<KickingFile | null>(null);

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);
  const isDefense = player.position === 'DST';
  const isKicker = player.position === 'K';

  const live: Array<[Tab, string]> = tonight ? [['tonight', 'Tonight']] : [];
  const tabs: Array<[Tab, string]> = isDefense
    ? [
        ...live,
        ['overview', 'Overview'],
        ['defense', 'Unit'],
        ['schedule', 'Schedule'],
        ['value', 'Value'],
        ['research', 'Research'],
      ]
    : isKicker
      ? [
          ...live,
          ['overview', 'Overview'],
          ['kicking', 'Kicking'],
          ['schedule', 'Schedule'],
          ['value', 'Value'],
          ['research', 'Research'],
        ]
      : [
          ...live,
          ['overview', 'Overview'],
          ['production', 'Production'],
          ['usage', 'Usage'],
          ['context', 'Offence'],
          ['career', 'Career'],
          ['schedule', 'Schedule'],
          ['value', 'Value'],
          ['research', 'Research'],
        ];

  const firstTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // The modal focuses its close button. Raised inline, nothing received focus
    // and a keyboard user landed at the top of the document behind the scrim;
    // the tab bar is the reason it was raised. The spotlight is inline too but
    // not escapable, and there focus belongs to the bid box.
    if (inline && escapable) firstTabRef.current?.focus();
    else closeRef.current?.focus();
  }, [inline, escapable]);

  useDismissOnEscape(onClose, escapable);

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
    if (isKicker) void loadKicking().then((file) => live && setKicking(file));
    return () => {
      live = false;
    };
  }, [player.id, team, isDefense, isKicker]);

  const latest = history?.[history.length - 1];
  const columns = statColumns(player.position);

  /*
   * The men he is actually competing with for a roster spot.
   *
   * `player.percentiles` reads over every player the pool holds, and the pool
   * is six hundred and twenty-eight people, most of them depth. Against that
   * field everybody worth opening a dossier on scores in the high nineties, so
   * the panel this replaced drew eight nearly-full bars and said nothing:
   * projected points 100th, ceiling 100th, floor 99th. A reading that is the
   * same for everybody you would look at is not a reading.
   *
   * The cohort is the startable half instead — his position, above replacement
   * level — which is the same principle the board's own instruments were fixed
   * on, and it is what makes a strip of the field worth drawing at all.
   */
  const startable = useMemo(() => {
    const bar = replacement ?? replacementPoints ?? null;
    return players.filter(
      (other) =>
        other.position === player.position &&
        !other.marketOnly &&
        (bar == null || other.projectedPoints > bar)
    );
  }, [players, player.position, replacement, replacementPoints]);

  const stripOf = useMemo(
    () =>
      (read: (entry: Player) => number | null | undefined): StripPoint[] =>
        startable
          .map((other) => ({
            id: other.id,
            name: getIdentity(other.id)?.name ?? other.name,
            value: read(other) ?? Number.NaN,
          }))
          .filter((point) => Number.isFinite(point.value)),
    [startable]
  );

  /*
   * One reading per club, never one per player.
   *
   * The offence strips answer "how does this offence compare with the other
   * thirty-one", and every player on a roster carries the identical context —
   * so bucketing per player would weight Kansas City by however many Chiefs the
   * pool happens to hold. That is a distribution of roster depth wearing the
   * label of a distribution of offences, and it is the same mistake
   * `offenceNorm` is shaped to avoid one layer down.
   */
  const clubStripOf = useMemo(() => {
    const perClub = new Map<string, Player>();
    for (const other of players) {
      if (!other.teamContext || perClub.has(other.team)) continue;
      perClub.set(other.team, other);
    }
    const clubs = [...perClub.entries()];
    return (read: (entry: Player) => number | null | undefined): StripPoint[] =>
      clubs
        .map(([club, entry]) => ({ id: club, name: club, value: read(entry) ?? Number.NaN }))
        .filter((point) => Number.isFinite(point.value));
  }, [players]);

  /*
   * Where a season's points came from, at this league's scoring.
   *
   * The components are computed rather than apportioned, and the remainder is
   * shown as `other` instead of being scaled away: a season also contains
   * two-point conversions and lost fumbles, and closing the gap by stretching
   * the parts would state a decomposition that is not the one that happened.
   */
  const mixSeasons = useMemo<MixSeason[]>(() => {
    if (!history?.length || !league) return [];
    return history.map((season) => {
      const total = pointsFor(
        { position: player.position, points: season.pprPoints, receptions: season.receptions },
        league
      );
      const touchdowns = (season.receivingTds + season.rushingTds) * 6;
      const receiving = season.receivingYards / 10 + season.receptions * league.receptionPoints;
      const rushing = season.rushingYards / 10;
      const passing = season.passingYards / 25 + season.passingTds * 4 - season.interceptions * 2;
      const other = total - touchdowns - receiving - rushing - passing;
      return {
        season: season.season,
        total,
        // Touchdowns first, so the band's height is directly comparable with
        // the tick drawn at the cohort's own share.
        parts: [
          { key: 'td', label: 'touchdowns', points: touchdowns },
          { key: 'rec', label: 'receiving', points: receiving },
          { key: 'rush', label: 'rushing', points: rushing },
          { key: 'pass', label: 'passing', points: passing },
          { key: 'other', label: 'everything else', points: Math.max(0, other) },
        ].filter((part) => part.points > 0.5),
        tdShare: total > 0 ? touchdowns / total : 0,
      };
    });
  }, [history, league, player.position]);

  /*
   * What a typical starter at this position takes from touchdowns.
   *
   * Measured over the cohort rather than chosen, because a constant nobody
   * derived is indistinguishable on screen from one three seasons produced —
   * the argument `modelTrust` already makes for carrying three blind spots and
   * not a dozen. The whole history file is in memory once anybody's game log
   * has loaded, so this is sixty map reads.
   */
  const tdNorm = useMemo(() => {
    if (!league || !history?.length) return null;
    const shares: number[] = [];
    for (const other of startable) {
      const season = seasonShape(other.id);
      if (!season) continue;
      const total = pointsFor(
        { position: other.position, points: season.pprPoints, receptions: season.receptions },
        league
      );
      if (total < 20) continue;
      shares.push(((season.receivingTds + season.rushingTds) * 6) / total);
    }
    if (shares.length < 6) return null;
    shares.sort((a, b) => a - b);
    return shares[Math.floor(shares.length / 2)];
  }, [startable, league, history]);

  /*
   * How hard the three weeks that decide a fantasy season are, for everybody at
   * his position.
   *
   * A strength-of-schedule number is a season average, and an average is
   * exactly the wrong summary: soft defences in December and a brutal September
   * beat the reverse at the identical mean. This is the December half on its
   * own, against the men he is competing with — which nobody at the table is
   * computing, and which is free once the schedule file is in memory.
   */
  const playoffStrips = useMemo(() => {
    if (!schedule?.length) return [];
    const easeFor = (club: string): number | null => {
      const games = teamSchedule(club);
      if (!games?.length) return null;
      const weeks = games.filter(
        (game) => game.week >= 15 && game.week <= 17 && game.difficulty != null
      );
      if (!weeks.length) return null;
      return weeks.reduce((sum, game) => sum + (game.difficulty ?? 0), 0) / weeks.length;
    };
    const cache = new Map<string, number | null>();
    return stripOf((entry) => {
      if (!cache.has(entry.team)) cache.set(entry.team, easeFor(entry.team));
      return cache.get(entry.team) ?? null;
    });
  }, [schedule, stripOf]);

  /*
   * The role, as one reading rather than three, and which share is asked about
   * depends on the job: a back is defined by his cut of the carries and a
   * receiver by his cut of the targets. Putting both on every player would
   * leave half of them reading zero for a reason that is about the position
   * rather than about the man.
   */
  const roleRead = useMemo(() => {
    const share =
      player.position === 'RB'
        ? { value: player.usage?.carryShare ?? null, metric: 'carry' as const, label: 'Carry' }
        : { value: player.usage?.targetShare ?? null, metric: 'target' as const, label: 'Target' };
    const snapNorm = positionNorm(player.position, 'snap');
    const shareNorm = positionNorm(player.position, share.metric);
    if (player.marketOnly || player.snapPercentage == null || share.value == null) return null;
    if (!snapNorm || !shareNorm) return null;
    return {
      snap: player.snapPercentage,
      snapNorm,
      share: share.value,
      shareNorm,
      shareLabel: share.label,
      redZone: player.usage?.redZoneTouches ?? 0,
      redZoneTop: positionNorm(player.position, 'redZone')?.top ?? 1,
      summary:
        `On the field for ${Math.round(player.snapPercentage)}% of snaps (median ${player.position} ${Math.round(snapNorm.median)}%), ` +
        `taking ${Math.round(share.value)}% of the ${share.metric === 'carry' ? 'carries' : 'targets'} (median ${Math.round(shareNorm.median)}%).`,
    };
  }, [player]);

  const caveats = useMemo(
    () =>
      modelCaveats({
        position: player.position,
        age: player.age ?? null,
        gamesObserved: player.gamesObserved ?? null,
        modelRank: player.modelRank,
        market: player.market,
      }),
    [player.position, player.age, player.gamesObserved, player.modelRank, player.market]
  );

  /* The whole position, for the scatter — which fades the men already gone and
     so wants them in the picture. */
  const cohort = useMemo(
    () => players.filter((other) => other.position === player.position),
    [players, player.position]
  );

  /* Over the startable cohort, like every other instrument here. Over all of
     the position the median running back sat *below* replacement and the value
     swarm piled at $1 — a picture of the pool's depth, not of the men he is
     competing with for a seat. */
  const swarmOf = useMemo(
    () =>
      (read: (p: Player) => number | null | undefined): SwarmPoint[] =>
        startable
          .map((other) => ({
            id: other.id,
            name: getIdentity(other.id)?.name ?? other.name,
            value: read(other) ?? Number.NaN,
          }))
          .filter((point) => Number.isFinite(point.value)),
    [startable]
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
        {tabs.map(([key, label], index) => (
          <button
            key={key}
            ref={index === 0 ? firstTabRef : undefined}
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

      {tab === 'tonight' && tonight}

      {tab === 'kicking' && (
        <div className="dr-tabpanel" role="tabpanel">
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Every kick, {kicking?.season ?? 'last season'}</h3>
            {kicking === null && <p className="dr-empty">Loading the kicks…</p>}
            {kicking && !kicking.kickers[player.id] && (
              <p className="dr-empty">
                No regular-season kicks on record for him in {kicking.season} — a rookie, or a man
                who did not have the job.
              </p>
            )}
            {kicking?.kickers[player.id] && (
              <KickChart
                kicker={kicking.kickers[player.id]}
                league={leagueBuckets(kicking)}
                label={`${player.name}: every field-goal attempt by week and distance`}
              />
            )}
            <p className="dr-footnote">
              Each row is a week and each mark an attempt at its distance, flying toward the posts:
              a dot made it, a cross missed, a diamond was blocked. Under it, his make rate by
              distance against the league&rsquo;s kickers as a whole &mdash; a made fifty-five is
              not the same fact as a made twenty-five.
            </p>
          </section>

          {kicking?.kickers[player.id] && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Week by week</h3>
              {/* The same instrument every other position gets, built from the
                  kicks: three, four and five by distance plus the extra points,
                  which is the table the pool scores kickers on. */}
              <GameLog
                weeks={kicking.kickers[player.id].games.map((game) => kickPoints(game))}
                replacement={(replacement ?? replacementPoints ?? 0) / 17}
                strongWeek={16}
                label={`${player.name}: points from kicks in each ${kicking.season} game`}
                width={420}
                height={64}
              />
              <p className="dr-footnote">
                A kicker&rsquo;s week is his offence&rsquo;s week: drives that stall inside the
                forty are attempts, touchdowns are extra points. The dashed rule is what a free
                kicker scores per game.
              </p>
            </section>
          )}

          {kicking && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Against the kickers who held a job</h3>
              {(() => {
                const cohort = kickerSummaries(kicking);
                const strip = (
                  read: (row: (typeof cohort)[number]) => number | null
                ): StripPoint[] =>
                  cohort
                    .map((row) => ({ id: row.id, name: row.name, value: read(row) ?? Number.NaN }))
                    .filter((point) => Number.isFinite(point.value));
                return (
                  <>
                    <MetricStrip
                      label="Points a game"
                      points={strip((row) => row.pointsPerGame)}
                      mineId={player.id}
                      format={(value) => value.toFixed(1)}
                    />
                    <MetricStrip
                      label="Attempts a game"
                      points={strip((row) => row.attemptsPerGame)}
                      mineId={player.id}
                      format={(value) => value.toFixed(1)}
                    />
                    <MetricStrip
                      label="Accuracy"
                      points={strip((row) => (row.accuracy == null ? null : row.accuracy * 100))}
                      mineId={player.id}
                      format={(value) => `${Math.round(value)}%`}
                    />
                    <MetricStrip
                      label="Made from 50+"
                      points={strip((row) => row.fiftyPlusMade)}
                      mineId={player.id}
                      format={(value) => `${Math.round(value)}`}
                    />
                    <MetricStrip
                      label="Longest"
                      points={strip((row) => row.long)}
                      mineId={player.id}
                      format={(value) => `${Math.round(value)}`}
                    />
                  </>
                );
              })()}
              <p className="dr-footnote">
                Every tick is a kicker with eight or more games last season. Attempts a game is the
                offence&rsquo;s doing and the part that carries over least; accuracy from fifty is
                his, and the part that separates him from the next man on the wire.
              </p>
            </section>
          )}
        </div>
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
            {/* The number this format actually turns on, where it is knowable.
                VORP is the gap to the last man the *league* rosters, which is
                the right bar when the auction buys a whole roster and the wrong
                one here — eleven seats a team are snaked for nothing, so what a
                bid buys is the gap to whoever survives to your pick. The bye
                week is a fine fact and it is not a headline. */}
            {gain != null ? (
              <div
                className="dr-tile"
                title={`Points over ${gainFree ?? 'the man the snake hands you free'}`}
              >
                <dt>Over free</dt>
                <dd style={{ color: gain > 0 ? 'var(--dr-good)' : 'var(--dr-warn)' }}>
                  {gain > 0 ? '+' : ''}
                  {gain}
                </dd>
              </div>
            ) : (
              <div className="dr-tile">
                <dt>Bye</dt>
                <dd>{player.byeWeek || '—'}</dd>
              </div>
            )}
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
            {/* The curve is the right picture and answers a question nobody
                has. The question people have arrives with a number already in
                it — "my other back gives me 210, does this man beat that" —
                and it is different for every reader, which is the case for
                making it draggable rather than drawing forty more marks. */}
            <Threshold
              projection={player.projectedPoints}
              floor={player.floor}
              ceiling={player.upside}
              replacement={replacement ?? replacementPoints ?? null}
              gain={gain}
            />
          </section>

          {startable.length > 5 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">
                Against the {startable.length} startable {player.position}s
              </h3>
              {/* Eight strips where eight percentile bars were. A bar is a
                  container: all eight read ninety-something on one shared 0-100
                  scale and the panel said the same thing eight times. What it
                  hid is the only interesting part — that the distributions
                  differ. Consistency is tight and crowded, ceiling is skewed
                  with a long thin tail, red-zone touches are bimodal because a
                  team either feeds a man at the goal line or it does not. A
                  percentile of 90 means something different in each. */}
              <MetricStrip
                label="Projected"
                points={stripOf((entry) => entry.projectedPoints)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}`}
                reference={
                  (replacement ?? replacementPoints) != null
                    ? { value: (replacement ?? replacementPoints)!, label: 'replacement' }
                    : null
                }
              />
              <MetricStrip
                label="Per game"
                points={stripOf((entry) => entry.pointsPerGame)}
                mineId={player.id}
                format={(value) => value.toFixed(1)}
              />
              <MetricStrip
                label="Ceiling"
                points={stripOf((entry) => entry.upside)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}`}
              />
              <MetricStrip
                label="Floor"
                points={stripOf((entry) => entry.floor)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}`}
              />
              <MetricStrip
                label="Consistency"
                points={stripOf((entry) => entry.consistency)}
                mineId={player.id}
                format={(value) => `${value}/10`}
              />
              <MetricStrip
                label="Snap share"
                points={stripOf((entry) => entry.snapPercentage)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}%`}
              />
              <MetricStrip
                label={player.position === 'RB' ? 'Carry share' : 'Target share'}
                points={stripOf((entry) =>
                  player.position === 'RB' ? entry.usage?.carryShare : entry.usage?.targetShare
                )}
                mineId={player.id}
                format={(value) => `${Math.round(value)}%`}
              />
              <MetricStrip
                label="Red zone"
                points={stripOf((entry) => entry.usage?.redZoneTouches)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}`}
              />
              <p className="dr-footnote">
                Every tick is one of the {startable.length} {player.position}s who beat replacement
                level — the men he is competing with for a roster spot, not the six hundred in the
                pool. The dot is him, the small arrow underneath is the median, and hovering names
                whoever is under the cursor.
              </p>
            </section>
          )}

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

          {/* Four categorical words — LOW, LOW, minor competition, stable — is
              what this section was, on a screen whose whole subject is how much
              to believe the number above it. Every one of those words is a
              summary of something measured, and the measurements are better. */}
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">What could go wrong</h3>
            <div className="dr-risks">
              {player.durability?.seasons?.length ? (
                <div className="dr-risk">
                  <Seasons
                    seasons={player.durability.seasons}
                    label={`Availability across ${player.durability.seasons.length} seasons`}
                    width={38}
                    height={22}
                  />
                  <span>
                    <b>
                      {player.durability.totalMissed}{' '}
                      {player.durability.totalMissed === 1 ? 'game' : 'games'} missed
                    </b>
                    <em>
                      {player.durability.seasons
                        .map((row) => `${row.season} ${row.missed}`)
                        .join(' · ')}
                    </em>
                  </span>
                </div>
              ) : null}

              {player.competition && player.competition.roomSize > 1 && (
                <div className="dr-risk">
                  <DepthLadder
                    depth={player.competition.depth}
                    roomSize={player.competition.roomSize}
                    aheadBy={player.competition.aheadBy}
                    behindBy={player.competition.behindBy}
                    label={`Number ${player.competition.depth} of ${player.competition.roomSize} in the room`}
                    width={40}
                    height={40}
                  />
                  <span>
                    <b>
                      {player.competition.depth} of {player.competition.roomSize} in the room
                    </b>
                    <em>
                      {player.competition.starterAhead
                        ? `behind ${player.competition.starterAhead}${player.competition.behindBy != null ? ` by ${player.competition.behindBy}/g` : ''}`
                        : player.competition.nextUp
                          ? `clear of ${player.competition.nextUp}${player.competition.aheadBy != null ? ` by ${player.competition.aheadBy}/g` : ''}`
                          : 'nobody behind him'}
                    </em>
                  </span>
                </div>
              )}

              <div className="dr-risk">
                <span>
                  <b>{player.recentTrends.toLowerCase()} production</b>
                  <em>
                    {player.competitionLevel.replace(/_/g, ' ').toLowerCase()}
                    {player.expectedGames != null &&
                      ` · ${player.expectedGames.toFixed(1)} games expected`}
                  </em>
                </span>
              </div>
            </div>

            {/* The three places the backtest measured this board worst, on this
                player. It renders here as well as on the nomination stage
                because a finding that lives in one panel is a finding nobody
                has at the moment a name is called. */}
            {caveats.length > 0 && (
              <>
                <div className="dr-card-risks" style={{ marginTop: 8 }}>
                  {caveats.map((caveat) => (
                    <span key={caveat.id} data-tone="warn" title={caveat.detail}>
                      {caveat.label}
                    </span>
                  ))}
                </div>
                <p className="dr-footnote">
                  Measured over three held-out seasons, these are the profiles our projection sorted
                  worst against the draft market. Trust the room over this board here.
                </p>
              </>
            )}
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

          {/* The same seventeen numbers, asked the other question.
              The log above is chronological, which answers "was he trending".
              This answers "how often did starting him win the week", and they
              are genuinely different: a man who is never bad and a man who is
              never good score the same on a symmetric variance measure, and a
              lineup cares enormously which one it has. Drawn as a staircase
              because the count only changes at the weeks he actually played. */}
          {latest && latest.weekly.length > 3 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">How many weeks he cleared a bar</h3>
              <WeeksAbove
                weeks={latest.weekly}
                replacement={(replacement ?? replacementPoints ?? 0) / 17}
                season={17}
              />
              <p className="dr-footnote">
                Read across at any score for the number of weeks he beat it. The denominator is a
                full season rather than games played, so weeks he missed are visibly weeks he
                cleared nothing — which is the only honest reading when what is being bought is a
                starting slot for eighteen weeks.
              </p>
            </section>
          )}

          {/* Two backs projected for the same total are not the same bet when
              one of them got ninety points of it from touchdowns. Touchdown
              rate is the least stable thing in football — handed out by field
              position and play-calling rather than earned at a repeatable rate
              — and the projection cannot say so, because it only ever saw the
              total. */}
          {mixSeasons.length > 0 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Where the points came from</h3>
              <ScoringMix seasons={mixSeasons} tdNorm={tdNorm} />
              <p className="dr-footnote">
                At this league&rsquo;s scoring, not the full PPR the source file counts. The dashed
                tick on each column is the share a typical startable {player.position} takes from
                touchdowns — a column whose warning band clears it is a season built on scores,
                which is the part least likely to repeat.
              </p>
            </section>
          )}

          {history && history.length > 1 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Season on season</h3>
              {/* Three game logs, not three polylines. The sparkline this
                  replaced joined games with a line, stretched a fifteen-game
                  season to the width of a seventeen-game one and drew no
                  replacement rule — the three things the GameLog above it was
                  built to stop doing, redrawn sixty pixels under it. Same
                  instrument, same bar, same scale, so the seasons compare. */}
              <div className="dr-multiples">
                {history.slice(-3).map((season) => (
                  <figure className="dr-multiple" key={season.season}>
                    <figcaption>
                      <b>{season.season}</b> <em>{season.games} games</em>
                    </figcaption>
                    <GameLog
                      weeks={season.weekly}
                      replacement={(replacement ?? replacementPoints ?? 0) / 17}
                      strongWeek={(positionNorm(player.position, 'ppg')?.top ?? 10) * 2}
                      label={`${player.name}: points in each ${season.season} game against replacement level`}
                      width={150}
                      height={34}
                    />
                  </figure>
                ))}
              </div>
            </section>
          )}

          {history && history.length > 0 && (
            <section className="dr-modal-section dr-full">
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
          {/* Snap share, touch share and red-zone work were three cells of a
              nine-cell list. They are not three questions — they are one, *is
              he the guy or is he a piece* — and a list makes the reader do that
              join. The field the card carries answers it as a location. */}
          {roleRead && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Is he the guy?</h3>
              <div className="dr-role-wide">
                <RoleField
                  snap={roleRead.snap}
                  snapMedian={roleRead.snapNorm.median}
                  snapTop={roleRead.snapNorm.top}
                  share={roleRead.share}
                  shareMedian={roleRead.shareNorm.median}
                  shareTop={roleRead.shareNorm.top}
                  redZone={roleRead.redZone}
                  redZoneTop={roleRead.redZoneTop}
                  label={roleRead.summary}
                  size={128}
                  quadrants
                />
                <dl className="dr-facts">
                  <div>
                    <dt>Snap share</dt>
                    <dd>{Math.round(roleRead.snap)}%</dd>
                  </div>
                  <div>
                    <dt>{roleRead.shareLabel} share</dt>
                    <dd>{Math.round(roleRead.share)}%</dd>
                  </div>
                  <div>
                    <dt>Red-zone touches</dt>
                    <dd>{roleRead.redZone}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
                  </div>
                  <div>
                    <dt>Games played</dt>
                    <dd>{player.usage?.games ?? player.lastSeasonGames ?? '—'}</dd>
                  </div>
                </dl>
              </div>
              <p className="dr-footnote">
                The crosshair is the median startable {player.position}: top right is a bell cow,
                top left a specialist, bottom right a decoy, bottom left a backup. The dot&rsquo;s
                size is red-zone work, which is a premium on the other two rather than a third
                question.
              </p>
            </section>
          )}

          {/* Eleven yards of target depth with three after the catch is a
              downfield receiver whose production is the quarterback's; three
              with eight after it is a screen game that survives a change at
              quarterback. Both average fourteen, and the list this replaces
              printed both as numerals two rows apart. */}
          {player.usage?.adot != null && player.usage.yacPerReception != null && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Where the ball reaches him</h3>
              <div className="dr-role-wide">
                <CatchDepth
                  adot={player.usage.adot}
                  yac={player.usage.yacPerReception}
                  adotMedian={positionNorm(player.position, 'adot')?.median ?? 0}
                  top={Math.max(18, player.usage.adot + player.usage.yacPerReception + 2)}
                  label={`Caught on average ${player.usage.adot} yards past the line, then ${player.usage.yacPerReception} more after it.`}
                  width={64}
                  height={104}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MetricStrip
                    label="aDOT"
                    points={stripOf((entry) => entry.usage?.adot)}
                    mineId={player.id}
                    format={(value) => `${value.toFixed(1)} yd`}
                    width={230}
                  />
                  <MetricStrip
                    label="YAC/catch"
                    points={stripOf((entry) => entry.usage?.yacPerReception)}
                    mineId={player.id}
                    format={(value) => `${value.toFixed(1)} yd`}
                    width={230}
                  />
                  <MetricStrip
                    label="WOPR"
                    points={stripOf((entry) => entry.usage?.wopr)}
                    mineId={player.id}
                    format={(value) => value.toFixed(2)}
                    width={230}
                  />
                  <MetricStrip
                    label="Air yd share"
                    points={stripOf((entry) => entry.usage?.airYardsShare)}
                    mineId={player.id}
                    format={(value) => `${Math.round(value)}%`}
                    width={230}
                  />
                </div>
              </div>
              <p className="dr-footnote">
                The solid rule is the line of scrimmage and the dashed one is the median target
                depth at his position: above it is a downfield job, on it is a checkdown. WOPR is
                target share and air-yards share as one number — the best single read on how central
                he is to a passing game.
              </p>
            </section>
          )}

          {/* Touchdowns are most of the gap between two players with the same
              yards, and both halves of who gets them — how often the offence
              arrives, and who the coach hands it to — were in the pool with
              nowhere on screen to be. */}
          {player.usage && player.teamContext?.redZoneTripsPerGame != null && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Scoring chances, and his cut</h3>
              <div className="dr-role-wide">
                <GoalLine
                  trips={player.teamContext.redZoneTripsPerGame}
                  tripsMedian={offenceNorm('redZoneTrips')?.median ?? 3}
                  touches={
                    player.usage.games > 0 ? player.usage.redZoneTouches / player.usage.games : 0
                  }
                  goalLine={
                    player.usage.games > 0 ? player.usage.goalLineTouches / player.usage.games : 0
                  }
                  label={`The offence reaches the red zone ${player.teamContext.redZoneTripsPerGame} times a game; he touches it ${(player.usage.redZoneTouches / Math.max(1, player.usage.games)).toFixed(1)} times there.`}
                  pitch={16}
                />
                <dl className="dr-facts">
                  <div>
                    <dt>Team trips / game</dt>
                    <dd>{player.teamContext.redZoneTripsPerGame}</dd>
                  </div>
                  <div>
                    <dt>His red-zone touches</dt>
                    <dd>
                      {player.usage.redZoneTouches}
                      {player.usage.redZoneShare != null && (
                        <span className="dr-facts-note">
                          {' '}
                          · {player.usage.redZoneShare}% of the team
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt title="Inside the five, where a touch is worth about six points a fifth of the time">
                      Goal-line touches
                    </dt>
                    <dd>{player.usage.goalLineTouches}</dd>
                  </div>
                </dl>
              </div>
            </section>
          )}

          {player.usage && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Volume and efficiency, {player.usage.season}</h3>
              <MetricStrip
                label="Touches/g"
                points={stripOf((entry) => entry.usage?.touchesPerGame)}
                mineId={player.id}
                format={(value) => value.toFixed(1)}
              />
              <MetricStrip
                label="Targets/g"
                points={stripOf((entry) => entry.usage?.targetsPerGame)}
                mineId={player.id}
                format={(value) => value.toFixed(1)}
              />
              <MetricStrip
                label="1st downs/g"
                points={stripOf((entry) => entry.usage?.firstDownsPerGame)}
                mineId={player.id}
                format={(value) => value.toFixed(1)}
              />
              <MetricStrip
                label="EPA/touch"
                points={stripOf((entry) => entry.usage?.epaPerTouch)}
                mineId={player.id}
                format={(value) => value.toFixed(3)}
                reference={{ value: 0, label: 'break even' }}
              />
              <p className="dr-footnote">
                Shares and rates are of his own team&rsquo;s volume, computed from the 2025
                play-by-play. The dashed rule on EPA is break-even: a touch that gains the offence
                nothing.
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
        </div>
      )}

      {tab === 'context' && (
        <div className="dr-tabpanel" role="tabpanel">
          {player.teamContext ? (
            <>
              {/* This tab was two lists of numerals and not one chart, on the
                  subject the whole tab exists for: opportunity is granted by a
                  team before it is earned by a player, and the same target
                  share is worth more on an offence running 68 plays a game than
                  58. A list has nowhere to put "than". */}
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">How the {team} play</h3>
                <PlayMix
                  plays={player.teamContext.playsPerGame}
                  playsTop={offenceNorm('plays')?.top ?? player.teamContext.playsPerGame}
                  playsMedian={offenceNorm('plays')?.median ?? player.teamContext.playsPerGame}
                  passRate={player.teamContext.neutralPassRate ?? 50}
                  passRateOverExpected={player.teamContext.passRateOverExpected}
                  label={`${player.teamContext.playsPerGame} plays a game, ${player.teamContext.neutralPassRate ?? '—'}% of neutral downs thrown.`}
                  width={280}
                  height={26}
                />
                <p className="dr-footnote">
                  The bar&rsquo;s length is plays a game against the league&rsquo;s fastest and the
                  arrow beneath it the median offence; the split inside is pass against run. The
                  dashed notch is the rate the <em>situations</em> called for — a proportion beside
                  its counterfactual is a claim about a coach rather than a fact about a scheme, and
                  it is the second one that moves a bid.
                </p>
              </section>

              {/* Where this offence sits among the thirty-two, which is the
                  only form the question has. "61.8 plays a game" is a number
                  nobody carries a reference for. */}
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">Against the other offences</h3>
                <MetricStrip
                  label="Plays / game"
                  points={clubStripOf((entry) => entry.teamContext?.playsPerGame)}
                  mineId={team}
                  format={(value) => value.toFixed(1)}
                />
                <MetricStrip
                  label="Pass rate"
                  points={clubStripOf((entry) => entry.teamContext?.neutralPassRate)}
                  mineId={team}
                  format={(value) => `${value.toFixed(0)}%`}
                />
                <MetricStrip
                  label="Pass vs expected"
                  points={clubStripOf((entry) => entry.teamContext?.passRateOverExpected)}
                  mineId={team}
                  format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`}
                  reference={{ value: 0, label: 'as expected' }}
                />
                <MetricStrip
                  label="EPA / play"
                  points={clubStripOf((entry) => entry.teamContext?.epaPerPlay)}
                  mineId={team}
                  format={(value) => value.toFixed(3)}
                  reference={{ value: 0, label: 'break even' }}
                />
                <MetricStrip
                  label="Red-zone trips"
                  points={clubStripOf((entry) => entry.teamContext?.redZoneTripsPerGame)}
                  mineId={team}
                  format={(value) => value.toFixed(1)}
                />
                <MetricStrip
                  label="Sacks allowed"
                  points={clubStripOf((entry) => entry.teamContext?.sackRateAllowed)}
                  mineId={team}
                  format={(value) => `${value.toFixed(1)}%`}
                  invert
                />
                <MetricStrip
                  label="Seconds / play"
                  points={clubStripOf((entry) => entry.teamContext?.secondsPerPlay)}
                  mineId={team}
                  format={(value) => `${value.toFixed(1)}s`}
                  invert
                />
                <p className="dr-footnote">
                  One tick per club, not per player — every man on a roster carries the same
                  offence, so counting them individually would weight a team by how many of its
                  players the pool happens to hold. Sack rate and seconds per play are read the
                  other way round: lower is better, and the percentile is flipped to say so.
                </p>
              </section>

              {player.competition && (
                <section className="dr-modal-section">
                  <h3 className="dr-eyebrow">Competition for the job</h3>
                  <div className="dr-role-wide">
                    <DepthLadder
                      depth={player.competition.depth}
                      roomSize={player.competition.roomSize}
                      aheadBy={player.competition.aheadBy}
                      behindBy={player.competition.behindBy}
                      label={`Number ${player.competition.depth} of ${player.competition.roomSize} in the room.`}
                      width={64}
                      height={96}
                    />
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
                  </div>
                  <p className="dr-footnote">
                    The rungs are drawn a distance apart proportional to the margin, because
                    &ldquo;1 of 4&rdquo; is the same fraction for a starter nine points a game clear
                    of his backup and one half a point clear — and the second loses the job in
                    September. Ordered by our own projection among his listed teammates.
                  </p>
                </section>
              )}
            </>
          ) : (
            <p className="dr-empty">No play-by-play for this team&rsquo;s 2025 offence.</p>
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

          {/* Where he is on the curve, against the men he is competing with.
              The arc above says what shape his own career is on; these say
              whether that shape is early or late for the position — which is
              the question the backtest cared about, having found thirty-and-over
              the worst age group this model projects, every season. */}
          {startable.length > 5 && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Against the position</h3>
              <MetricStrip
                label="Age"
                points={stripOf((entry) => entry.age)}
                mineId={player.id}
                format={(value) => `${value}`}
                reference={{ value: 30, label: 'the blind spot' }}
                invert
              />
              <MetricStrip
                label="Games of tape"
                points={stripOf((entry) => entry.gamesObserved)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}`}
                reference={{ value: 16, label: 'partial-season tape' }}
              />
              <MetricStrip
                label="Games missed"
                points={stripOf((entry) => entry.durability?.totalMissed)}
                mineId={player.id}
                format={(value) => `${Math.round(value)}`}
                invert
              />
              <MetricStrip
                label="Expected games"
                points={stripOf((entry) => entry.expectedGames)}
                mineId={player.id}
                format={(value) => value.toFixed(1)}
              />
              <p className="dr-footnote">
                Both dashed rules are places the backtest measured this board worst: past thirty it
                over-projects by 52 to 66 points a man, and on one to sixteen games of tape it
                showed no ranking signal at all across three held-out seasons.
              </p>
              {caveats.length > 0 && (
                <div className="dr-card-risks" style={{ marginTop: 8 }}>
                  {caveats.map((caveat) => (
                    <span key={caveat.id} data-tone="warn" title={caveat.detail}>
                      {caveat.label}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {player.durability && (
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Durability</h3>
              <div className="dr-role-wide">
                <Seasons
                  seasons={player.durability.seasons}
                  label={`Games played in each of ${player.durability.seasons.length} seasons`}
                  width={54}
                  height={34}
                />
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
              </div>
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
            <>
              <section className="dr-modal-section dr-full">
                <h3 className="dr-eyebrow">{team} season</h3>
                <ScheduleStrip games={schedule} byeWeek={player.byeWeek ?? null} />
              </section>

              {/* The whole tab was that one strip. A season is eighteen
                  separate bets and the three at the end of it are worth the
                  other fifteen, because they are the ones played when the
                  league is decided — so they get named rather than averaged
                  away into a number out of ten. */}
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">The weeks it is decided in</h3>
                <ul className="dr-weeklist">
                  {schedule
                    .filter((game) => game.week >= 15 && game.week <= 17)
                    .map((game) => (
                      <li key={game.week}>
                        <span className="dr-weeklist-week dr-num">W{game.week}</span>
                        <span className="dr-weeklist-opp">
                          {game.home ? 'vs' : 'at'} {game.opponent}
                        </span>
                        <span className="dr-weeklist-track">
                          <span
                            className="dr-weeklist-fill"
                            style={{
                              width: `${Math.round((game.difficulty ?? 0) * 100)}%`,
                              background:
                                (game.difficulty ?? 0) >= 0.62
                                  ? 'var(--dr-good)'
                                  : (game.difficulty ?? 0) <= 0.32
                                    ? 'var(--dr-warn)'
                                    : 'var(--dr-line-strong)',
                            }}
                          />
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="dr-footnote">
                  Longer and greener is a defence that gave up more last season. Bye in week{' '}
                  {player.byeWeek || '—'}, which is the one week of the eighteen he is guaranteed to
                  score nothing.
                </p>
              </section>

              {/* Nobody at the table is computing this, and it is free once the
                  schedule file is in memory: how his December compares with the
                  December of every other man he could be bought instead of. */}
              {playoffStrips.length > 5 && (
                <section className="dr-modal-section">
                  <h3 className="dr-eyebrow">December, against the other {player.position}s</h3>
                  <MetricStrip
                    label="Weeks 15-17"
                    points={playoffStrips}
                    mineId={player.id}
                    format={(value) => `${Math.round(value * 100)}% soft`}
                  />
                  <p className="dr-footnote">
                    The average of how much his weeks 15 to 17 opponents gave up, against the same
                    figure for every startable {player.position}. A season average cannot say this:
                    soft defences in December and a brutal September beat the reverse at the
                    identical mean, and only one of those stretches is played when it counts.
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'defense' && (
        <div className="dr-tabpanel" role="tabpanel">
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">2025 defensive production</h3>
            {/* Thirty-two units, so the cohort is complete rather than a
                sample — which makes a strip the most informative thing that can
                be drawn here, and a list of five numerals about the least. A
                defence with thirty-eight sacks is only interesting relative to
                the other thirty-one, and none of them was on screen. */}
            <MetricStrip
              label="Sacks"
              points={stripOf((entry) => entry.defense?.sacks)}
              mineId={player.id}
              format={(value) => `${Math.round(value)}`}
            />
            <MetricStrip
              label="Interceptions"
              points={stripOf((entry) => entry.defense?.interceptions)}
              mineId={player.id}
              format={(value) => `${Math.round(value)}`}
            />
            <MetricStrip
              label="Fumbles"
              points={stripOf((entry) => entry.defense?.fumbleRecoveries)}
              mineId={player.id}
              format={(value) => `${Math.round(value)}`}
            />
            <MetricStrip
              label="Touchdowns"
              points={stripOf((entry) => entry.defense?.touchdowns)}
              mineId={player.id}
              format={(value) => `${Math.round(value)}`}
            />
            <MetricStrip
              label="Points allowed"
              points={stripOf((entry) => entry.defense?.pointsAllowedPerGame)}
              mineId={player.id}
              format={(value) => value.toFixed(1)}
              invert
            />
            <p className="dr-footnote">
              Points allowed is read the other way round — lower is better, and the percentile is
              flipped to say so. Defensive scoring barely predicts itself year to year, which is why
              every one of these prices out at a dollar or two whatever the strip says.
            </p>
          </section>

          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">Defensive personnel</h3>
            {defense === null && <p className="dr-empty">Loading the unit…</p>}
            {defense && (
              <DepthChart
                units={defense}
                label={`${player.name}: the unit on the field, with the depth behind it`}
              />
            )}
            <p className="dr-footnote">
              Four down, three behind, two wide, two deep, from the current ESPN roster in the order
              it publishes &mdash; jersey, which stands in for a depth chart the feed does not have.
              The row under the field is the depth. Point at a man for his age, his years and his
              size; amber rings are first- and second-year players.
            </p>
          </section>
        </div>
      )}

      {tab === 'value' && (
        <div className="dr-tabpanel" role="tabpanel">
          {/* The "What to bid" ladder that sat here read `analytics.maxBid`,
              which is `riskAdjustedValue × 1.15` — the same multiplier for
              everybody, so it ranked players exactly as their prices already did
              and printed a second walk-away that disagreed with the plan's by ten
              dollars on the same screen. The plan's number is the one number, and
              it is read below beside what a bid buys. */}
          {/* Every other price on this screen is a number somebody else arrived
              at. The one that decides the night is the number about to be said
              out loud, and it moves a dollar at a time while people shout — so
              the useful thing is the same three readings recomputed at whatever
              is being considered, rather than a fourth static figure. */}
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">What a bid buys</h3>
            <BidScrub
              list={player.estimatedValue}
              adjusted={analytics ? analytics.adjustedValue : null}
              projection={player.projectedPoints}
              gain={gain}
              gainFree={gainFree}
              ceiling={ceiling}
              walkAway={walkAway}
            />
          </section>

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
            {/* Six unrelated cells is the shape of a lookup table, and this is
                not one — it is a chain. A list price derived from points over
                replacement, multiplied by what the room is paying tonight,
                multiplied by what this roster still needs. The useful reading
                is which step moved it, because "the model likes him" and "you
                need one and the room is hot" are different reasons to be
                looking at the same $54, and only one of them survives you
                filling the slot. */}
            <PriceChain
              steps={[
                {
                  label: 'Over replacement',
                  dollars: player.modelValue,
                  applied: `${player.valueOverReplacement} pts`,
                  note: "Value over replacement, turned into a share of the league's budget.",
                },
                ...(player.customRanking
                  ? [
                      {
                        label: 'Your ranking',
                        dollars: player.estimatedValue,
                        applied: 'imported',
                        note: 'An imported ranking or the bundled consensus is driving this board.',
                      },
                    ]
                  : []),
                ...(analytics
                  ? [
                      {
                        label: "Tonight's room",
                        dollars: player.estimatedValue * analytics.marketInflation,
                        applied: `×${analytics.marketInflation}`,
                        note: 'Money still unspent against the value still for sale.',
                      },
                      {
                        label: 'Your need',
                        dollars: analytics.adjustedValue,
                        applied: `×${analytics.needMultiplier}`,
                        note: 'What an unfilled starting slot at this position is worth to you.',
                      },
                    ]
                  : []),
              ]}
            />
            <dl className="dr-facts">
              <div>
                <dt>Tier</dt>
                <dd>{player.tier}</dd>
              </div>
              {analytics && (
                <div>
                  <dt title="Position gone: how much of what this position had for sale is already off the board">
                    Position gone
                  </dt>
                  <dd>{`${Math.round(analytics.positionScarcity * 100)}%`}</dd>
                </div>
              )}
              {analytics && (
                <div>
                  <dt title="How much of this player we have actually seen play">Confidence</dt>
                  <dd>{`${analytics.confidenceLevel}%`}</dd>
                </div>
              )}
            </dl>
            <p className="dr-footnote">
              {analytics
                ? 'Inflation and need move the list price as the draft runs; the last bar is the price to actually decide against.'
                : 'Put him on the block to see tonight’s inflation and your own need folded in — those two steps are about the room, and the room has not been asked yet.'}
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
