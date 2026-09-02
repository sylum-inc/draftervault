import type React from 'react';
import { memo, useCallback, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Player, PositionPulse } from '@/services/auctionDraftService';
import { researchMark } from '@/services/playerResearch';
import { getIdentity, teamColors } from '@/services/nflIdentity';
import { accentFor, inkFor } from '@/lib/accent';
import { Headshot } from './Headshot';
import {
  CareerArc,
  CatchDepth,
  Consensus,
  DepthLadder,
  GameLog,
  GoalLine,
  MoneyBite,
  Outcome,
  PlayMix,
  RoleField,
  RunTape,
  Seasons,
  SeasonAhead,
  Shelf,
  SlotFit,
} from './charts/micro';
import { careerShape, weeklySeason, weeklyShape } from '@/services/playerHistory';
import { teamSchedule } from '@/services/nflSchedule';
import { offenceNorm, positionNorm, type NormMetric } from '@/lib/positionNorms';
import { modelCaveats } from '@/lib/modelTrust';

interface PlayerCardProps {
  player: Player;
  selected: boolean;
  /**
   * Whether the research file has finished loading.
   *
   * The marks themselves live in a module-level map that is filled once and
   * never changes, so a card reads them directly rather than being handed an
   * object — an object prop would be a new reference on every render and would
   * defeat the memo this list depends on. This boolean flips false to true
   * exactly once, which re-renders the board a single time with the marks in.
   */
  researchReady?: boolean;
  /**
   * Whether the three-season history file has landed.
   *
   * Same bargain as `researchReady` and for the same reason: the shapes live in
   * a module-level cache a card reads directly, because an array prop per card
   * would be a new reference on every render and would defeat the memo the
   * board depends on. It flips false to true exactly once, which re-renders the
   * board a single time with the sparklines in.
   */
  historyReady?: boolean;
  watched: boolean;
  onSelect: (player: Player) => void;
  onToggleWatch: (playerId: string) => void;
  onTogglePin: (playerId: string) => void;
  pinned: boolean;
  /**
   * Turn the card over.
   *
   * Clicking the card itself puts a player on the block, which is the auction's
   * primary act and may not change — so studying somebody needs its own
   * affordance. It sits with the watch and pin controls, appears on hover for
   * the same reason they do, and is the only one of the three that is not a
   * per-person note.
   *
   * The rectangle is passed back because the *expand* that follows animates
   * from where the card actually sits on the board, and by the time anything
   * renders at the centre of the screen the cell it came from is behind a
   * scrim and no longer a thing the overlay can ask about.
   */
  onFlip?: (playerId: string, origin?: DOMRect) => void;
  flipped?: boolean;
  /**
   * Grow the turned-over card into the full dossier.
   *
   * Deliberately reachable only from the back. The front is what is read while
   * a name is being called and it may not turn into a screen-filling panel on
   * one click; the back is already a deliberate act, so the step from a dense
   * second page to every tab of it is the natural next one rather than a
   * surprise.
   */
  onExpand?: (playerId: string, origin?: DOMRect) => void;
  expanded?: boolean;
  /**
   * The dossier, rendered inside the card once it is open.
   *
   * Passed in rather than built here so the card stays a card: it knows how to
   * be big, and the room knows what to put in the space. Undefined on the other
   * fifty-nine, which is a stable prop and leaves their memo alone.
   */
  detail?: ReactNode;
  /**
   * Where the card was on the board when it was opened.
   *
   * The lift animates *from* here, which is what makes it read as this card
   * rising rather than as a panel appearing. Measured at the moment of the
   * click, because by the time it renders the card it came from is behind a
   * scrim and its position is no longer something the overlay can ask for.
   */
  liftFrom?: { dx: number; dy: number; scale: number };
  /**
   * What buying him gains over the man the snake hands you free, in points.
   *
   * Passed as primitives rather than as the object the engine returns, and the
   * reason is the memo above: an object prop is a new reference on every render
   * and would re-render all sixty cards on every pick, which is the exact cost
   * the board was measured and fixed for once. The whole board's gains are
   * computed in one pass upstream; a card's three numbers only change when its
   * own position's free man does, so shallow comparison holds.
   *
   * Undefined when the outlook cannot honestly be computed — no sheet, no team
   * marked as yours — in which case the row is simply absent rather than zero.
   */
  gainLow?: number;
  gainHigh?: number;
  gainFree?: string | null;
  gainSlot?: string;
  /**
   * What the draft has done to his position, as of this pick.
   *
   * The only prop here that is an object rather than a primitive, and the only
   * one that changes during a draft. It is safe because it is *stabilised*
   * upstream: six of these serve sixty cards, and an entry is replaced only
   * when its contents actually differ — so buying a running back re-renders the
   * running backs and leaves the receivers alone. Undefined before the engine
   * has one, in which case the live band is simply absent.
   */
  pulse?: PositionPulse;
}

/**
 * Where the card sits on the screen, from anything inside it.
 *
 * Measured at the moment of the click rather than from a ref, because the lift
 * animates *from* the cell the card was in and by the time the expanded copy
 * renders that cell is behind a scrim. `closest` rather than a walk up the
 * parents, so a control nested one deeper than expected still finds the card.
 */
const rectOf = (node: EventTarget & Element): DOMRect | undefined =>
  node.closest('.dr-card')?.getBoundingClientRect();

const RISK_COLOR: Record<Player['injuryRisk'], string> = {
  LOW: 'var(--dr-value)',
  MEDIUM: 'var(--dr-caution)',
  HIGH: 'var(--dr-danger)',
};

/**
 * One card on the board.
 *
 * Wrapped in `memo` because the board holds 628 of these and React re-renders
 * the whole list on every keystroke in the search box and every pick made.
 * Unmemoised that cost roughly a second of frozen interface per nomination on
 * an ordinary laptop; each card also resolves its identity and team colours, so
 * the work is not trivial per instance.
 */
const PlayerCardView = ({
  player,
  selected,
  researchReady = false,
  historyReady = false,
  watched,
  pinned,
  onSelect,
  onToggleWatch,
  onTogglePin,
  onFlip,
  flipped = false,
  onExpand,
  expanded = false,
  detail,
  liftFrom,
  gainLow,
  gainHigh,
  gainFree,
  gainSlot,
  pulse,
}: PlayerCardProps) => {
  const identity = getIdentity(player.id);
  const mark = researchReady ? researchMark(player.id) : null;

  const readoutRef = useRef<HTMLSpanElement>(null);
  const onReadout = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const node = readoutRef.current;
    if (!node) return;
    const target = event.target as Element | null;
    const tip = target?.closest?.('[data-tip]')?.getAttribute('data-tip') ?? null;
    if (tip) {
      node.textContent = tip;
      node.hidden = false;
    } else if (!node.hidden) {
      node.hidden = true;
    }
  }, []);
  const clearReadout = useCallback(() => {
    if (readoutRef.current) readoutRef.current.hidden = true;
  }, []);
  const weekly = historyReady ? weeklyShape(player.id) : null;
  const weeklyYear = historyReady ? weeklySeason(player.id) : null;
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);

  const usage = player.usage;

  // What a freely available player at his position scores, recovered from the
  // two numbers the card already has. VORP is points over replacement, so
  // replacement is the projection minus it — no new plumbing, and it is the
  // reference two of the three instruments below are drawn against.
  const replacement = player.projectedPoints - player.valueOverReplacement;
  const spread = player.upside - player.floor;

  // What a dollar buys, which is the comparison an auction is actually making
  // and which nothing on the card was doing for you.
  const perDollar = player.estimatedValue > 0 ? player.projectedPoints / player.estimatedValue : 0;

  // The market's own rank, kept beside ours. `adp` is whatever is *driving* the
  // board, so after "Use consensus" it is the market's; `modelRank` is always
  // ours. Printing one as though it were both is the mistake two other panels
  // were already caught making.
  const theirRank = player.market?.consensusRank ?? null;

  const risks: Array<{ label: string; tone: string; title: string }> = [];
  if (player.competitionLevel === 'TIMESHARE' || player.competitionLevel === 'COMMITTEE') {
    risks.push({
      label: player.competitionLevel === 'TIMESHARE' ? 'timeshare' : 'committee',
      tone: 'warn',
      title: player.competition?.nextUp
        ? `Splitting the job — ${player.competition.nextUp} is behind him`
        : 'Splitting the job with somebody else',
    });
  }
  if (player.recentTrends !== 'STABLE') {
    risks.push({
      label: player.recentTrends === 'RISING' ? 'rising' : 'declining',
      tone: player.recentTrends === 'RISING' ? 'good' : 'bad',
      title: `Recent production is ${player.recentTrends.toLowerCase()}`,
    });
  }

  /*
   * The role, as one reading rather than three.
   *
   * Which share matters depends on the job: a back is defined by his cut of the
   * carries and a receiver by his cut of the targets, and putting both on every
   * card would leave half of them reading zero for a reason that is about the
   * position rather than the player. So the axis is "his share of the work he
   * is there to do", named accordingly.
   */
  const roleShare =
    player.position === 'RB'
      ? { value: usage?.carryShare ?? null, metric: 'carry' as NormMetric, label: 'Car' }
      : { value: usage?.targetShare ?? null, metric: 'target' as NormMetric, label: 'Tgt' };
  const snapNorm = positionNorm(player.position, 'snap');
  const shareNorm = positionNorm(player.position, roleShare.metric);
  const redZoneNorm = positionNorm(player.position, 'redZone');

  const role =
    !player.marketOnly &&
    player.snapPercentage != null &&
    roleShare.value != null &&
    snapNorm &&
    shareNorm
      ? {
          snap: player.snapPercentage,
          snapNorm,
          share: roleShare.value,
          shareNorm,
          shareLabel: roleShare.label,
          redZone: usage?.redZoneTouches ?? 0,
          redZoneTop: redZoneNorm?.top ?? 1,
          summary:
            `On the field for ${Math.round(player.snapPercentage)}% of snaps (median ${player.position} ${Math.round(snapNorm.median)}%), ` +
            `taking ${Math.round(roleShare.value)}% of the ${roleShare.metric === 'carry' ? 'carries' : 'targets'} (median ${Math.round(shareNorm.median)}%), ` +
            `with ${usage?.redZoneTouches ?? 0} red-zone touches. The crosshair is the median ${player.position}; the dot's size is red-zone work.`,
        }
      : null;

  /*
   * Where he stands in what is left at his position.
   *
   * Matched on the projection rather than on an id, because the shelf carries
   * points and not names — it is six small arrays of numbers serving sixty
   * cards, and putting ids in it would double its size to answer a question one
   * comparison already answers. A tie between two men projected identically
   * lights the first, which is the correct answer to "where does a player with
   * this projection sit on this shelf" even when it is the wrong man.
   */
  const shelfIndex = pulse
    ? pulse.shelf.findIndex((points) => points === Math.round(player.projectedPoints))
    : -1;

  const style = {
    '--dr-accent': primary,
    '--dr-accent-ink': inkFor(primary),
    // The same hue, lifted into a band that reads on the ground. Anything drawn
    // *on* the dark surface uses this; only the position badge, which sets its
    // own ink, gets the raw club colour.
    '--dr-accent-lift': accentFor(primary),
  } as CSSProperties;

  const face = (
    <>
      <span
        className="dr-card-star dr-star"
        role="button"
        tabIndex={0}
        aria-pressed={watched}
        aria-label={watched ? `Stop watching ${player.name}` : `Watch ${player.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleWatch(player.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onToggleWatch(player.id);
          }
        }}
      >
        {watched ? '★' : '☆'}
      </span>
      {/* Put him up top. The whole card already nominates on click, and that
          stays; this is the same act with a glyph on it, because a face that
          must be clicked somewhere to do the one thing the board is for is a
          control nobody was told about. It is the first in the cluster since it
          is the one used with money on the table. */}
      <span
        className="dr-card-spot"
        role="button"
        tabIndex={0}
        aria-label={`Spotlight ${player.name} — put him up top`}
        title="Spotlight — put him up top, with the full dossier and tonight's numbers"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(player);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onSelect(player);
          }
        }}
      >
        ◎
      </span>
      {onFlip && (
        <span
          className="dr-card-open"
          role="button"
          tabIndex={0}
          aria-label={`Turn ${player.name} over`}
          title="Turn the card over — the offence, the room, the career and the season ahead"
          onClick={(event) => {
            event.stopPropagation();
            onFlip(player.id, rectOf(event.currentTarget));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onFlip(player.id, rectOf(event.currentTarget));
            }
          }}
        >
          ↻
        </span>
      )}
      <span
        className={`dr-card-pin${pinned ? ' is-pinned' : ''}`}
        role="button"
        tabIndex={0}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${player.name}` : `Pin ${player.name} to compare`}
        title={pinned ? 'Pinned for comparison' : 'Pin to compare'}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePin(player.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onTogglePin(player.id);
          }
        }}
      >
        ⇄
      </span>

      {/* Identity, price and the two decision numbers on one line.
          The card used to open with an 88x64 photo in an 84px band, so two
          fifths of it was a picture and the price was a cell in a grid below
          the fold of the eye. During an auction nobody browses portraits: a
          name is called and the question is what it costs. So the photo is a
          40px mark beside the name — enough to recognise a face, not enough to
          push the number that decides a bid down the card — and the price is
          the second thing read after the name, which is the order the room
          actually reads in. The card went from 260px to about 150, so twice as
          many are on screen. */}
      <div className="dr-card-head">
        <Headshot
          identity={identity}
          fallbackName={player.name}
          width={96}
          className="dr-card-photo"
        />
        <span className="dr-card-id">
          <span className="dr-card-name">{identity?.name ?? player.name}</span>
          <span className="dr-card-meta">
            <span className="dr-pos">{player.position}</span>
            {team}
            {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
            <span className="dr-tier dr-num" data-tier={player.tier}>
              T{player.tier}
            </span>
            {/* A fact about the player like every other chip on this line. As a
                fourth grid child it overflowed into a row of its own under the
                photo — sixteen pixels on every card for one six-pixel dot. */}
            <span
              className="dr-flag"
              style={{ background: RISK_COLOR[player.injuryRisk] }}
              title={`${player.injuryRisk.toLowerCase()} injury risk`}
            />
            {mark && mark.direction !== 'NEUTRAL' && (
              <span
                className="dr-card-research dr-research-mark"
                style={{
                  color: mark.direction === 'PAY_UP' ? 'var(--dr-value)' : 'var(--dr-danger)',
                }}
                title={`${mark.headline || 'Sourced findings'} — open the Research tab`}
                aria-label={`Research: ${mark.direction === 'PAY_UP' ? 'pay up' : 'fade'}`}
              >
                {mark.direction === 'PAY_UP' ? '↑' : '↓'}
              </span>
            )}
            {/* Off the commissioner's sheet is not the same as cheap. A player
            nobody is bidding on reads as a $1 scrub otherwise, when what he
            actually is is somebody you take in the snake for nothing. The flag
            rides on the player object, so the memo above still holds. */}
            {!player.onSheet && player.sheetIsStated && (
              <span
                className="dr-snake"
                title="Not on the auction sheet — he comes up in the snake"
              >
                snake
              </span>
            )}
            {/* Was a four-line paragraph on every card, which turned the fourteen
            players we know least about into the loudest thing on the board.
            The fact is worth one word; the explanation belongs on hover, and
            in full on the nomination stage where a bid is actually decided. */}
            {player.marketOnly && (
              <span
                className="dr-nodata"
                title="No projection — the pool has never heard of him. He is on the board because real drafts are taking him, and his price is whatever the market's rank buys on our curve."
              >
                no data
              </span>
            )}
          </span>
        </span>

        <span
          className={`dr-card-price${player.customRanking ? ' is-custom' : ''}`}
          title={
            player.customRanking ? `Your ranking. Ours says $${player.modelValue}.` : undefined
          }
        >
          ${player.estimatedValue}
        </span>
      </div>

      {/* The season's shape, on its own line and at the card's own width.
          Wedged into the head beside the price it cost the name its column and
          the board read "Jahmy r Gibbs", "Christi an…", "Amon- Ra S…" — four of
          the sixteen dearest players unreadable, which is the one thing a name
          on a card has to do. It is also a better instrument at 232px than at
          74: a sparkline is a shape, and a shape needs room. */}
      {/* The live half. Everything above the rule is a fact about the player and
          reads the same at pick one and at pick a hundred and fifty; everything
          in here moves as the room drafts. Kept together and marked, so it is
          obvious which numbers are answering "what is he" and which are
          answering "what is happening". */}
      {pulse && !player.marketOnly && (
        <div className="dr-card-live">
          <div className="dr-card-live-row">
            <span className="dr-card-live-glyphs">
              <Shelf
                shelf={pulse.shelf}
                names={pulse.shelfNames}
                mine={shelfIndex}
                replacement={pulse.replacement}
                label={`${pulse.startable} ${player.position}s left above replacement of ${pulse.left} undrafted. He is the ${shelfIndex >= 0 ? `number ${shelfIndex + 1}` : 'not among the'} best left.`}
              />
              {/* Only once there is a window to read: ten empty cells before
                  the first pick were a strip of nothing on sixty cards. */}
              {pulse.window > 0 && (
                <RunTape
                  gone={pulse.goneRecently}
                  window={pulse.window}
                  label={`${pulse.goneRecently} of the last ${pulse.window} picks were ${player.position}s`}
                />
              )}
            </span>
            {/* Quiet, because it is the same number on every card at the
                position — the sockets already show it. */}
            <span className="dr-card-live-read dr-card-live-read-quiet">
              <em>{pulse.startable} left</em>
            </span>
          </div>

          <div className="dr-card-live-row">
            <span className="dr-card-live-glyphs">
              <MoneyBite
                price={player.estimatedValue}
                mine={pulse.myCeiling}
                rivals={pulse.rivals}
                names={pulse.rivalNames}
                label={`He lists at $${player.estimatedValue}; you can go to $${pulse.myCeiling}; ${pulse.rivals.filter((ceiling) => ceiling > player.estimatedValue).length} teams with room here can beat that price.`}
              />
            </span>
            {/* The count belongs with the bar it reads: how many teams with room
                here can still go past his price. It was the quiet caption under
                the seat pips, labelling an instrument in the other column. */}
            <span className="dr-card-live-read">
              <b className="dr-num">
                {pulse.rivals.filter((ceiling) => ceiling > player.estimatedValue).length}
              </b>
              <em>can beat</em>
            </span>
          </div>
        </div>
      )}

      {/* Seventeen Sundays, against what a free player at his position scores
          per game. The dashed rule is that bar and it sits at the same height
          on every card, so two strips can be compared straight down a column —
          which a self-scaled sparkline could never be. The empty sockets are
          the weeks he was not available, which a line hid entirely. */}
      {weekly && (
        <div
          className="dr-card-gamelog"
          title={`${weeklyYear ?? 'Last season'}: ${weekly.length} of 17 games. The dashed line is ${Math.round(replacement / 17)} points a game — what a freely available ${player.position} scores. ${weekly.filter((week) => week >= replacement / 17).length} weeks beat it.`}
        >
          <GameLog
            weeks={weekly}
            replacement={replacement / 17}
            /* Twice a strong starter's average, which is about where a big
               week lands: at 14.2 points a game for the ninetieth-percentile
               back, full height is 28 and an average week sits a little over
               half way. Tighter than that and every column pinned. */
            strongWeek={(positionNorm(player.position, 'ppg')?.top ?? replacement / 17) * 2}
            label={`${weeklyYear ?? 'Last season'} game by game against replacement level`}
          />
        </div>
      )}

      {/* A market-only player carries placeholder zeroes because `Player`
          requires numbers on these fields, and printing one would state a
          measurement nobody made — "projected 0" reads identically to a
          projection of zero. The dash is what we actually know. */}
      <dl className="dr-card-stats">
        <div
          className="dr-card-stat"
          data-tip="Projected points this season at this league's scoring"
        >
          <dt>Proj</dt>
          <dd>{player.marketOnly ? '—' : player.projectedPoints}</dd>
        </div>
        <div className="dr-card-stat">
          <dt>VORP</dt>
          <dd>{player.marketOnly ? '—' : player.valueOverReplacement}</dd>
        </div>
        <div className="dr-card-stat" title="Projected points per dollar of list price">
          <dt>Pt/$</dt>
          <dd>{player.marketOnly || !perDollar ? '—' : perDollar.toFixed(1)}</dd>
        </div>
      </dl>

      {/* Floor, projection, ceiling — the shape of the bet, not just its size.
          Two players projected the same are different bids when one has a
          hundred-point range and the other four hundred, and that was in the
          profile behind two clicks nobody makes with money on the table. */}
      {!player.marketOnly && spread > 0 && (
        <div
          className="dr-card-range"
          title={`Floor ${player.floor} · projected ${player.projectedPoints} · ceiling ${player.upside}. Floor and ceiling are one standard deviation either side, so this is the distribution; the amber is the share of it that finishes below ${Math.round(replacement)} — what a free ${player.position} scores.`}
        >
          <span className="dr-num dr-card-range-end">{player.floor}</span>
          <Outcome
            floor={player.floor}
            projection={player.projectedPoints}
            ceiling={player.upside}
            replacement={replacement > 0 ? replacement : null}
            label={`Floor ${player.floor}, projected ${player.projectedPoints}, ceiling ${player.upside}, replacement level ${Math.round(replacement)}`}
          />
          <span className="dr-num dr-card-range-end">{player.upside}</span>
        </div>
      )}

      {/* Ours against theirs, side by side and labelled.
          `adp` is whatever is driving the board — the market's, after Use
          consensus — and `modelRank` is always ours. The board printed one of
          them under the heading "Rank" and left you to guess which. */}
      {!player.marketOnly && (
        <div className="dr-card-ranks">
          <span title="Where our own board ranks him">
            <em>ours</em>
            <b className="dr-num">#{player.modelRank}</b>
          </span>
          <span title="Where the room ranks him — real drafts where they reach, expert consensus past where they stop">
            <em>room</em>
            <b className="dr-num">{theirRank != null ? `#${theirRank}` : '—'}</b>
          </span>
          <span title="Weekly consistency, 1-10, from the variance of his own game logs">
            <em>consist</em>
            <b className="dr-num">{player.consistency ?? '—'}</b>
          </span>
          {/* Availability as three columns rather than a total, because a
              total hides whether six missed games were one bad year or a
              pattern — and those are different bets with the same sum. Falls
              back to the risk word for anyone with no seasons on file. */}
          <span
            title={
              player.durability?.seasons.length
                ? `Games missed by season: ${player.durability.seasons.map((entry) => `${entry.season} — ${entry.missed}`).join(', ')}`
                : `${player.injuryRisk.toLowerCase()} injury risk`
            }
          >
            <em>avail</em>
            {player.durability?.seasons.length ? (
              <Seasons
                seasons={player.durability.seasons}
                label={`Availability across ${player.durability.seasons.length} seasons`}
              />
            ) : (
              <b style={{ color: RISK_COLOR[player.injuryRisk] }}>
                {player.injuryRisk.slice(0, 3).toLowerCase()}
              </b>
            )}
          </span>
        </div>
      )}

      {/* The three numbers that explain the projection, each with its standing
          in the position — a share means nothing without one. */}
      {/* The instrument cluster: is he the guy, or is he a piece?
          These three are not three unrelated numbers, they are one question,
          and the answer is the shape across all of them — high on everything is
          a workhorse, middling on everything is a committee, high snaps with
          low carries and no red zone is a specialist. Stacked as three bars you
          read three lengths one after another; side by side, the pattern of
          three needles is one glance. */}
      {/* One field rather than three needles. "Is he the guy" is a question
          about the combination of how often he is out there and how much of
          the work he takes, and three separate readings make the reader do
          that join in their head with money on the table. The crosshair is the
          median player at his position, so the answer is a location: top right
          is a bell cow, top left a specialist, bottom right a decoy, bottom
          left a backup. The mark's size is red-zone work, which is a premium
          on the other two rather than a third question. */}
      {role && (
        <div className="dr-card-role">
          <RoleField
            snap={role.snap}
            snapMedian={role.snapNorm.median}
            snapTop={role.snapNorm.top}
            share={role.share}
            shareMedian={role.shareNorm.median}
            shareTop={role.shareNorm.top}
            redZone={role.redZone}
            redZoneTop={role.redZoneTop}
            label={role.summary}
          />
          <dl className="dr-card-role-read">
            <div>
              <dt>Snap</dt>
              <dd className="dr-num">{Math.round(role.snap)}%</dd>
            </div>
            <div>
              <dt>{role.shareLabel}</dt>
              <dd className="dr-num">{Math.round(role.share)}%</dd>
            </div>
            <div>
              <dt>Red zn</dt>
              <dd className="dr-num">{role.redZone}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* The one number nobody else at the table is computing.
          In this format eleven or twelve roster spots a team are snaked for
          nothing, so what a bid buys is not what the player is worth — it is
          how much better he is than the man you get free at the same seat.
          Roster-aware, so a third running back is measured against the flex
          rather than against a starting slot that is already full. */}
      {gainHigh != null && (
        <span
          className="dr-card-gain"
          data-slot={gainSlot}
          data-negative={gainHigh <= 0 ? '' : undefined}
          title={
            gainSlot === 'bench'
              ? 'Your slots at his position and your flex are both full — he adds nothing to the lineup that scores'
              : `Projected points this bid buys over ${gainFree ?? 'the free man'}, who the snake hands you for nothing`
          }
        >
          {gainSlot === 'bench' ? (
            <>bench only</>
          ) : (
            <>
              <b className="dr-num">
                {/* Signed per number, not once for the pair. Prefixing the
                    whole range printed "+-30–12" for a back whose gain is
                    negative at an early draw and positive at a late one —
                    which is exactly the case the range exists to show. */}
                {gainLow == null || gainLow === gainHigh
                  ? `${gainHigh > 0 ? '+' : ''}${gainHigh}`
                  : `${gainLow > 0 ? '+' : ''}${gainLow} to ${gainHigh > 0 ? '+' : ''}${gainHigh}`}
              </b>{' '}
              {/* The name only when there is one man to name. Across a range
                  the two ends are two different free players — the best one
                  survives to an early draw and the worst to a late one — so
                  printing the second of them beside both numbers would say the
                  low end was measured against somebody it was not. */}
              {gainLow === gainHigh ? `over ${gainFree ?? 'free'}` : 'over the free man'}
            </>
          )}
          {pulse && (
            <SlotFit
              total={pulse.slotsTotal}
              filled={pulse.slotsFilled}
              flexOpen={pulse.flexOpen}
              who={pulse.mySeats}
              label={`${pulse.slotsFilled} of ${pulse.slotsTotal} starting ${player.position} seats filled${pulse.flexOpen ? ', flex still open' : ''}`}
            />
          )}
        </span>
      )}

      {/* What happened last Tuesday, which no projection knows. The direction
          arrow was in the meta line already; the headline is the part that
          changes a bid, and it was two panels away. */}
      {mark && mark.direction !== 'NEUTRAL' && mark.headline && (
        <span className="dr-card-news" data-direction={mark.direction} title={mark.headline}>
          {mark.headline}
        </span>
      )}

      {risks.length > 0 && (
        <div className="dr-card-risks">
          {risks.map((risk) => (
            <span key={risk.label} data-tone={risk.tone} title={risk.title}>
              {risk.label}
            </span>
          ))}
        </div>
      )}
    </>
  );

  /*
   * The second page, built only for the card that is actually turned over.
   *
   * Sixty of these would be sixty career arcs, sixty schedule strips and sixty
   * reads of two lazy caches, on a board whose whole performance story is that
   * it mounts sixty cards without stalling. Exactly one card is ever flipped,
   * so the cost is one card's worth and the memo on the other fifty-nine is
   * untouched — `flipped` is a boolean and false on all of them.
   */
  const context = player.teamContext ?? null;
  const room = player.competition ?? null;
  const career = flipped ? careerShape(player.id) : null;
  const season = flipped ? teamSchedule(team) : null;
  const caveats = flipped
    ? modelCaveats({
        position: player.position,
        age: player.age ?? null,
        gamesObserved: player.gamesObserved ?? null,
        modelRank: player.modelRank,
        market: player.market,
      })
    : [];

  const playsNorm = offenceNorm('plays');
  const tripsNorm = offenceNorm('redZoneTrips');
  // Per game rather than per season, because the offence's own number beside it
  // is per game and a season total against a per-game rate is not a comparison.
  const usageGames = usage?.games && usage.games > 0 ? usage.games : null;
  const perGame = (total: number | null | undefined) =>
    total == null || usageGames == null ? null : total / usageGames;

  const adotNorm = positionNorm(player.position, 'adot');
  const signed = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

  const back = flipped ? (
    <div className="dr-card-backface">
      <div className="dr-back-head">
        <span className="dr-back-id">
          <b>{identity?.name ?? player.name}</b>
          <em>
            {player.position} · {team}
            {player.age != null && ` · ${player.age}y`}
            {player.experience != null && ` · yr ${player.experience + 1}`}
          </em>
        </span>
        {onExpand && (
          <button
            type="button"
            className="dr-back-btn"
            aria-label={`Expand ${player.name} to the full dossier`}
            title="Every tab, full width"
            onClick={(event) => {
              event.stopPropagation();
              onExpand(player.id, rectOf(event.currentTarget));
            }}
          >
            ⤢
          </button>
        )}
        {onFlip && (
          <button
            type="button"
            className="dr-back-btn"
            aria-label={
              expanded ? `Back to ${player.name}'s card` : `Turn ${player.name} back over`
            }
            title={expanded ? 'Back to the card' : 'Back to the front'}
            onClick={(event) => {
              event.stopPropagation();
              onFlip(player.id);
            }}
          >
            ↺
          </button>
        )}
      </div>

      <div className="dr-back-body">
        {/* Opportunity is granted by a team before it is earned by a player,
            and none of it was anywhere on the board. */}
        {context &&
          playsNorm &&
          context.playsPerGame != null &&
          context.neutralPassRate != null && (
            <section className="dr-back-block">
              <h4>The offence</h4>
              <PlayMix
                plays={context.playsPerGame}
                playsTop={playsNorm.top}
                playsMedian={playsNorm.median}
                passRate={context.neutralPassRate}
                passRateOverExpected={context.passRateOverExpected}
                label={`${context.playsPerGame.toFixed(1)} plays a game against a league top of ${playsNorm.top.toFixed(1)}; ${context.neutralPassRate.toFixed(0)}% of neutral downs thrown${
                  context.passRateOverExpected != null
                    ? `, which is ${signed(context.passRateOverExpected)} points against what the situations called for — the dashed notch`
                    : ''
                }.`}
              />
              <dl className="dr-back-reads">
                <div>
                  <dt>Plays/g</dt>
                  <dd className="dr-num">{context.playsPerGame.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>Pass</dt>
                  <dd className="dr-num">{Math.round(context.neutralPassRate)}%</dd>
                </div>
                {context.passRateOverExpected != null && (
                  <div title="Pass rate over expected — how much more this offence throws than the game situations called for. A choice, not a script.">
                    <dt>PROE</dt>
                    <dd
                      className="dr-num"
                      data-tone={context.passRateOverExpected > 0 ? 'good' : undefined}
                    >
                      {signed(context.passRateOverExpected)}
                    </dd>
                  </div>
                )}
                {context.epaPerPlay != null && (
                  <div title="Expected points added per play. The offence's own quality, independent of volume.">
                    <dt>EPA/play</dt>
                    <dd className="dr-num">{context.epaPerPlay.toFixed(2)}</dd>
                  </div>
                )}
                {context.sackRateAllowed != null && (
                  <div title="Sack rate allowed — the line in front of him, and the reason a passing game stalls.">
                    <dt>Sack%</dt>
                    <dd className="dr-num">{context.sackRateAllowed.toFixed(1)}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

        {/* Touchdowns are most of the gap between two players with the same
            yards, and they are handed out rather than earned at random. */}
        {context?.redZoneTripsPerGame != null && tripsNorm && usage && (
          <section className="dr-back-block">
            <h4>Near the goal line</h4>
            <GoalLine
              trips={context.redZoneTripsPerGame}
              tripsMedian={tripsNorm.median}
              touches={perGame(usage.redZoneTouches) ?? 0}
              goalLine={perGame(usage.goalLineTouches) ?? 0}
              label={`The offence reaches the red zone ${context.redZoneTripsPerGame.toFixed(1)} times a game (median ${tripsNorm.median.toFixed(1)}); he touches it ${(perGame(usage.redZoneTouches) ?? 0).toFixed(1)} times there, ${(perGame(usage.goalLineTouches) ?? 0).toFixed(1)} of them inside the five — the solid pips.`}
            />
            <dl className="dr-back-reads">
              <div>
                <dt>Trips/g</dt>
                <dd className="dr-num">{context.redZoneTripsPerGame.toFixed(1)}</dd>
              </div>
              <div title="His touches inside the twenty, per game">
                <dt>His RZ</dt>
                <dd className="dr-num">{(perGame(usage.redZoneTouches) ?? 0).toFixed(1)}</dd>
              </div>
              <div title="Inside the five, where a touch is worth about six points a fifth of the time">
                <dt>Goal line</dt>
                <dd className="dr-num">{usage.goalLineTouches}</dd>
              </div>
              {usage.redZoneShare != null && (
                <div title="His share of the team's red-zone work">
                  <dt>RZ share</dt>
                  <dd className="dr-num">{Math.round(usage.redZoneShare)}%</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* A fraction hides the one fact that decides whether he keeps the job. */}
        {room && room.roomSize > 0 && (
          <section className="dr-back-block dr-back-block-row">
            <DepthLadder
              depth={room.depth}
              roomSize={room.roomSize}
              aheadBy={room.aheadBy}
              behindBy={room.behindBy}
              label={`Number ${room.depth} of ${room.roomSize} in the room${
                room.aheadBy != null
                  ? `, clear of ${room.nextUp ?? 'the next man'} by ${room.aheadBy.toFixed(1)} points a game`
                  : ''
              }${room.behindBy != null ? `, behind ${room.starterAhead ?? 'the starter'} by ${room.behindBy.toFixed(1)} points a game` : ''}.`}
            />
            <div className="dr-back-block-body">
              <h4>The room</h4>
              <p className="dr-back-say">
                <b className="dr-num">
                  {room.depth} of {room.roomSize}
                </b>{' '}
                {room.starterAhead
                  ? `behind ${room.starterAhead}${room.behindBy != null ? ` by ${room.behindBy.toFixed(1)}/g` : ''}`
                  : room.nextUp
                    ? `clear of ${room.nextUp}${room.aheadBy != null ? ` by ${room.aheadBy.toFixed(1)}/g` : ''}`
                    : 'with nobody behind him'}
              </p>
              <p className="dr-back-say dr-back-say-quiet">
                {player.competitionLevel.replace(/_/g, ' ').toLowerCase()}
                {player.primaryBackup ? ` · backup ${player.primaryBackup}` : ''}
              </p>
            </div>
          </section>
        )}

        {/* Against age rather than against the calendar, because thirty-and-over
            is one of the three places the backtest says not to trust us. */}
        {career && career.length > 0 && (
          <section className="dr-back-block">
            <h4>The career, against his age</h4>
            <CareerArc
              seasons={career}
              projected={player.marketOnly ? null : (player.pointsPerGame ?? null)}
              projectedAge={player.age != null ? player.age + 1 : null}
              label={`Points a game in each of his ${career.length} seasons plotted against how old he was; the dot size is games played, the shaded region is thirty and over — where this model over-projects by 52 to 66 points a man — and the open ring is what it says he will average next year.`}
            />
            <dl className="dr-back-reads">
              {player.age != null && (
                <div>
                  <dt>Age</dt>
                  <dd className="dr-num" data-tone={player.age >= 30 ? 'warn' : undefined}>
                    {player.age}
                  </dd>
                </div>
              )}
              {player.breakoutSeason != null && (
                <div title="The first season he scored like a starter">
                  <dt>Broke out</dt>
                  <dd className="dr-num">{player.breakoutSeason}</dd>
                </div>
              )}
              {player.draftCapital && (
                <div
                  title={`Drafted round ${player.draftCapital.round}, pick ${player.draftCapital.pick} in ${player.draftCapital.year} by ${player.draftCapital.team}`}
                >
                  <dt>Drafted</dt>
                  <dd className="dr-num">
                    R{player.draftCapital.round}.{player.draftCapital.pick}
                  </dd>
                </div>
              )}
              {player.gamesObserved != null && (
                <div title="Games of tape the projection was built from. One to sixteen is the model's worst input, by a distance.">
                  <dt>Tape</dt>
                  <dd
                    className="dr-num"
                    data-tone={player.gamesObserved <= 16 ? 'warn' : undefined}
                  >
                    {player.gamesObserved}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Where the ball actually reaches him, which two numerals in a table
            could never say together. */}
        {usage && (
          <section className="dr-back-block dr-back-block-row">
            {usage.adot != null && usage.yacPerReception != null && (
              <CatchDepth
                adot={usage.adot}
                yac={usage.yacPerReception}
                adotMedian={adotNorm?.median ?? 0}
                top={Math.max(18, usage.adot + usage.yacPerReception + 2)}
                label={`Caught on average ${usage.adot.toFixed(1)} yards past the line${
                  adotNorm
                    ? ` against a median ${player.position} of ${adotNorm.median.toFixed(1)} — the dashed rule`
                    : ''
                }, then ${usage.yacPerReception.toFixed(1)} more after it. The line of scrimmage is the solid rule at the bottom.`}
              />
            )}
            <div className="dr-back-block-body">
              <h4>The ball</h4>
              <dl className="dr-back-reads">
                {usage.adot != null && (
                  <div title="Average depth of target — how far past the line the ball is thrown to him">
                    <dt>aDOT</dt>
                    <dd className="dr-num">{usage.adot.toFixed(1)}</dd>
                  </div>
                )}
                {usage.yacPerReception != null && (
                  <div title="Yards he adds himself, after the catch">
                    <dt>YAC</dt>
                    <dd className="dr-num">{usage.yacPerReception.toFixed(1)}</dd>
                  </div>
                )}
                {usage.wopr != null && (
                  <div title="Weighted opportunity rating: target share and air-yards share as one number. The best single measure of how central he is to a passing game.">
                    <dt>WOPR</dt>
                    <dd className="dr-num">{usage.wopr.toFixed(2)}</dd>
                  </div>
                )}
                {usage.touchesPerGame != null && (
                  <div>
                    <dt>Touch/g</dt>
                    <dd className="dr-num">{usage.touchesPerGame.toFixed(1)}</dd>
                  </div>
                )}
                {usage.firstDownsPerGame != null && (
                  <div title="First downs a game — the touches that keep his own offence on the field">
                    <dt>1D/g</dt>
                    <dd className="dr-num">{usage.firstDownsPerGame.toFixed(1)}</dd>
                  </div>
                )}
                {usage.epaPerTouch != null && (
                  <div title="Expected points added per touch. Efficiency, where the front of the card carries volume.">
                    <dt>EPA/tch</dt>
                    <dd className="dr-num" data-tone={usage.epaPerTouch > 0 ? 'good' : 'warn'}>
                      {usage.epaPerTouch.toFixed(2)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
        )}

        {/* How much the room disagrees with itself, which is what decides
            whether disagreeing with it means anything. */}
        {player.market?.best != null &&
          player.market.worst != null &&
          player.market.consensusRank != null && (
            <section className="dr-back-block">
              <h4>What the experts think of each other</h4>
              <Consensus
                best={player.market.best}
                worst={player.market.worst}
                consensus={player.market.consensusRank}
                ours={player.modelRank}
                label={`The panel ranks him between ${player.market.best} and ${player.market.worst}, landing at ${player.market.consensusRank}. We say ${player.modelRank} — ${
                  player.modelRank < player.market.best || player.modelRank > player.market.worst
                    ? 'outside the range of every expert opinion, which is where this board has been measured wrong'
                    : 'inside their own range'
                }.`}
              />
              <dl className="dr-back-reads">
                <div>
                  <dt>Ours</dt>
                  <dd className="dr-num">#{player.modelRank}</dd>
                </div>
                <div>
                  <dt>Panel</dt>
                  <dd className="dr-num">#{player.market.consensusRank}</dd>
                </div>
                <div title="How far apart the experts are from each other. A wide spread is a position nobody has an answer to.">
                  <dt>Spread</dt>
                  <dd className="dr-num">
                    {player.market.best}–{player.market.worst}
                  </dd>
                </div>
                {player.market.ownership != null && (
                  <div title="Share of leagues he is rostered in">
                    <dt>Rostered</dt>
                    <dd className="dr-num">{Math.round(player.market.ownership)}%</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

        {/* An average over a season is exactly the wrong summary for a schedule:
            the three weeks it is decided in are worth the other fourteen. */}
        {season && season.length > 0 && (
          <section className="dr-back-block">
            <h4>The eighteen weeks ahead</h4>
            <SeasonAhead
              games={season}
              byeWeek={player.byeWeek ?? null}
              label={`The 2026 season week by week — taller and green is a defence that gave up more last season, the hollow socket is the bye in week ${player.byeWeek ?? '—'}, and the rule underneath weeks 15 to 17 is the fantasy playoffs.`}
            />
            <dl className="dr-back-reads">
              <div>
                <dt>Bye</dt>
                <dd className="dr-num">{player.byeWeek ?? '—'}</dd>
              </div>
              {player.strengthOfSchedule != null && (
                <div title="Strength of schedule, 1 hardest to 10 softest — the season's average, which the strip above is the shape of">
                  <dt>SoS</dt>
                  <dd className="dr-num">{player.strengthOfSchedule}</dd>
                </div>
              )}
              {player.playoffSchedule && (
                <div title="Weeks 15 to 17, where a fantasy season is decided">
                  <dt>Playoffs</dt>
                  <dd
                    className="dr-num"
                    data-tone={
                      player.playoffSchedule === 'EASY'
                        ? 'good'
                        : player.playoffSchedule === 'DIFFICULT'
                          ? 'warn'
                          : undefined
                    }
                  >
                    {player.playoffSchedule.toLowerCase()}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Weeks on the injury report by body part. Treatment rather than
            absences, which is a different and earlier signal than games missed
            — and the only place in the pool that carries it. */}
        {player.durability?.reported && player.durability.reported.length > 0 && (
          <section className="dr-back-block">
            <h4>On the report</h4>
            <ul className="dr-back-parts">
              {player.durability.reported.slice(0, 5).map((entry) => (
                <li key={entry.part}>
                  <span>{entry.part.toLowerCase()}</span>
                  <b className="dr-num">{entry.weeks}w</b>
                </li>
              ))}
            </ul>
            <p className="dr-back-say dr-back-say-quiet">
              {player.durability.totalMissed}{' '}
              {player.durability.totalMissed === 1 ? 'game' : 'games'} missed across{' '}
              {player.durability.seasons.length}{' '}
              {player.durability.seasons.length === 1 ? 'season' : 'seasons'}
            </p>
          </section>
        )}

        {/* Where the backtest says this board is worst, on this player. The same
            three the nomination stage carries, because a finding that lives in
            one place is a finding nobody has when it matters. */}
        {caveats.length > 0 && (
          <section className="dr-back-block">
            <h4>Where to trust the room over us</h4>
            <div className="dr-card-risks">
              {caveats.map((caveat) => (
                <span key={caveat.id} data-tone="warn" title={caveat.detail}>
                  {caveat.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* The third register: what happened last Tuesday, which no projection
            knows and no instrument can draw. */}
        {mark && mark.direction !== 'NEUTRAL' && (
          <section className="dr-back-block">
            <h4>What the web said</h4>
            <p className="dr-back-say" data-direction={mark.direction}>
              {mark.headline || 'Sourced findings — open the Research tab'}
            </p>
          </section>
        )}
      </div>

      {/* The second page is taller than a card, so it scrolls — and a scroll
          with nothing at its edge to say so is a page that ends at the fold for
          anybody who does not happen to try. The bar is sticky rather than
          appended for that reason: it sits at the bottom of the *view*, so it
          is the thing under the last visible reading whatever has been scrolled
          past, and it carries the way out of the scroll rather than only a
          notice that there is one. Absent once the card is raised, where there
          is nothing left to open and nothing left to scroll. */}
      {!expanded && onExpand && (
        <div className="dr-back-more">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onExpand(player.id, rectOf(event.currentTarget));
            }}
          >
            Everything, full width ⤢
          </button>
        </div>
      )}
    </div>
  ) : null;

  /*
   * Front, back, and the back grown. One card in three states.
   *
   * The interaction is deliberately a sequence rather than a switch, and the
   * order was got wrong twice before it was got right. Expanding straight off
   * the front is a screen-filling panel on a single click, on the one surface
   * somebody is scanning while a name is being called — and the click that does
   * it is a hair away from the click that nominates. Turning the card over is
   * the softer act: it costs the front face, nothing else, and it happens
   * between nominations rather than during one. Only from there, having already
   * decided to study somebody, does growing to every tab of it make sense.
   *
   * So: click the card to nominate, `↻` to turn it over, `⤢` on the back to
   * raise it. Each step is reversible by the control that made it.
   */
  if (expanded) {
    /*
     * Lift it out of the board rather than reflowing the board around it.
     *
     * Spanning the grid was tried and it is wrong twice over: the cells beside
     * it in its own row are left empty, which reads as a rendering fault, and
     * everything below jumps down the page — so the board being read is
     * rearranged as the price of reading one card of it. It rises to the middle
     * instead and the rest recedes behind a scrim, which moves nothing and puts
     * everything back the instant it closes.
     *
     * The lift animates *from* the cell it came from, measured at the click,
     * which is what makes it read as this card rising rather than as a panel
     * appearing. A panel that fades in at the centre is a modal, and a modal is
     * the thing this is deliberately not.
     */
    const lifted = {
      ...style,
      ...(liftFrom
        ? {
            '--dr-lift-dx': `${liftFrom.dx}px`,
            '--dr-lift-dy': `${liftFrom.dy}px`,
            '--dr-lift-scale': String(liftFrom.scale),
          }
        : {}),
    } as CSSProperties;
    return (
      <article
        className="dr-card is-expanded"
        style={lifted}
        aria-label={`${player.name} detail`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dr-card-back">{back}</div>
        <div className="dr-card-detail">
          {/* Who, how much, and over whom — on every tab. The price and the
              gain lived only in the Overview tiles, so on seven of the eight
              tabs the number a bid is decided on was nowhere on the screen. */}
          <div className="dr-card-detail-bar">
            <span className="dr-detail-id">
              <Headshot
                identity={identity}
                fallbackName={player.name}
                width={56}
                className="dr-detail-face"
              />
              <span className="dr-detail-name">{identity?.name ?? player.name}</span>
              <span className="dr-pos">{player.position}</span>
              <span className="dr-detail-price">${player.estimatedValue}</span>
              {gainHigh != null && gainSlot !== 'bench' && (
                <span
                  className="dr-detail-gain"
                  data-tone={gainHigh > 0 ? undefined : 'warn'}
                  title={`Points over ${gainFree ?? 'the free man'}, free in the snake`}
                >
                  {gainLow == null || gainLow === gainHigh
                    ? `${gainHigh > 0 ? '+' : ''}${gainHigh}`
                    : `${gainLow > 0 ? '+' : ''}${gainLow}…${gainHigh > 0 ? '+' : ''}${gainHigh}`}{' '}
                  over free
                </span>
              )}
            </span>
            <button type="button" className="dr-button" onClick={() => onSelect(player)}>
              Put him on the block
            </button>
            {onFlip && (
              <button
                type="button"
                className="dr-button dr-detail-close"
                onClick={() => onFlip(player.id)}
                title="Back to the card — or press Escape"
              >
                Close · Esc
              </button>
            )}
          </div>
          {detail}
        </div>
      </article>
    );
  }

  /*
   * Two faces on one hinge.
   *
   * The front stays in the document flow and sets the cell's height; the back
   * is absolutely positioned over it, so turning the card over never moves the
   * fifty-nine cards around it. A back that reflowed the grid would make the
   * act of studying one player rearrange the board you were studying him
   * against, which is the same objection the expansion answers one level up.
   *
   * `aria-hidden` and `inert` on the hidden face are not decoration: without
   * them a screen reader reads both faces of every card and tab lands on
   * controls nobody can see.
   */
  const hinge = (
    <div className="dr-flip" data-flipped={flipped ? 'true' : undefined}>
      <div className="dr-flip-inner">
        <button
          type="button"
          className="dr-card dr-flip-face dr-flip-front"
          /* Hovering an instrument names the thing under the cursor in a strip
             along the card's foot. Read off `data-tip` by delegation and written
             straight into a DOM node rather than through state: sixty memoised
             cards, and a re-render per mouse move on any of them is the cost the
             board was measured and fixed for once. */
          onMouseMove={onReadout}
          onMouseLeave={clearReadout}
          style={style}
          aria-selected={selected}
          aria-hidden={flipped || undefined}
          tabIndex={flipped ? -1 : undefined}
          onClick={() => onSelect(player)}
        >
          <span className="dr-card-readout" ref={readoutRef} aria-live="polite" hidden />
          {face}
        </button>
        <div
          className="dr-card dr-flip-face dr-flip-back"
          style={style}
          aria-hidden={!flipped || undefined}
          aria-label={`${player.name}, the second page`}
        >
          {back}
        </div>
      </div>
    </div>
  );

  return hinge;
};

/**
 * Re-render only when something about this card actually changed.
 *
 * The board hands every card the same stable callbacks, so this comes down to
 * the player object, whether it is selected, watched or pinned. Reference
 * equality on the player is right: the engine returns fresh arrays on every
 * sync, but the player objects inside are the same instances unless the draft
 * moved them.
 */
export const PlayerCard = memo(PlayerCardView);
