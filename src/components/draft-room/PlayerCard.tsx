import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Player, PositionPulse } from '@/services/auctionDraftService';
import { researchMark } from '@/services/playerResearch';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';
import {
  GameLog,
  MoneyBite,
  Outcome,
  RoleField,
  RunTape,
  Seasons,
  Shelf,
  SlotFit,
} from './charts/micro';
import { weeklySeason, weeklyShape } from '@/services/playerHistory';
import { positionNorm, type NormMetric } from '@/lib/positionNorms';

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

/** Readable ink for a team color, so light jerseys don't get white-on-white. */
const inkFor = (hex: string): string => {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#0b0f17' : '#ffffff';
};

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
  gainLow,
  gainHigh,
  gainFree,
  gainSlot,
  pulse,
}: PlayerCardProps) => {
  const identity = getIdentity(player.id);
  const mark = researchReady ? researchMark(player.id) : null;
  const weekly = historyReady ? weeklyShape(player.id) : null;
  const weeklyYear = historyReady ? weeklySeason(player.id) : null;
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);

  const usage = player.usage;
  const edge = player.market?.edge ?? null;

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
  } as CSSProperties;

  return (
    <button
      type="button"
      className="dr-card"
      style={style}
      aria-selected={selected}
      onClick={() => onSelect(player)}
    >
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
        {logo && <img className="dr-card-logo" src={logo} alt="" aria-hidden="true" />}
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
            <span className="dr-tier dr-num">T{player.tier}</span>
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

        <span
          className="dr-flag"
          style={{ background: RISK_COLOR[player.injuryRisk] }}
          title={`${player.injuryRisk.toLowerCase()} injury risk`}
        />
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
                mine={shelfIndex}
                replacement={pulse.replacement}
                label={`${pulse.startable} ${player.position}s left above replacement of ${pulse.left} undrafted. He is the ${shelfIndex >= 0 ? `number ${shelfIndex + 1}` : 'not among the'} best left.`}
              />
              <RunTape
                gone={pulse.goneRecently}
                window={pulse.window}
                label={`${pulse.goneRecently} of the last ${pulse.window || 10} picks were ${player.position}s`}
              />
            </span>
            <span className="dr-card-live-read">
              <b className="dr-num">{pulse.startable}</b>
              <em>startable</em>
            </span>
          </div>

          <div className="dr-card-live-row">
            <span className="dr-card-live-glyphs">
              <MoneyBite
                price={player.estimatedValue}
                mine={pulse.myCeiling}
                rivals={pulse.rivals}
                label={`He lists at $${player.estimatedValue}; you can go to $${pulse.myCeiling}; ${pulse.rivals.filter((ceiling) => ceiling > player.estimatedValue).length} teams with room here can beat that price.`}
              />
            </span>
            <span
              className="dr-card-live-read"
              title={
                gainSlot === 'bench'
                  ? 'Your seats at his position and your flex are both full'
                  : `${pulse.slotsFilled} of ${pulse.slotsTotal} ${player.position} seats filled${pulse.flexOpen ? ', flex still open' : ''}`
              }
            >
              <SlotFit
                total={pulse.slotsTotal}
                filled={pulse.slotsFilled}
                flexOpen={pulse.flexOpen}
                label={`${pulse.slotsFilled} of ${pulse.slotsTotal} starting ${player.position} seats filled`}
              />
              <em>{pulse.rivals.filter((c) => c > player.estimatedValue).length} can beat</em>
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
        <div className="dr-card-stat">
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

      {edge != null && Math.abs(edge) >= 8 && (
        <span
          className="dr-card-edge"
          style={{ color: edge > 0 ? 'var(--dr-value)' : 'var(--dr-caution)' }}
          title={
            edge > 0
              ? `Expert consensus ranks him ${edge} spots below our board`
              : `Expert consensus ranks him ${Math.abs(edge)} spots above our board`
          }
        >
          {edge > 0
            ? `${edge} spots cheaper than consensus`
            : `${Math.abs(edge)} spots hotter than us`}
        </span>
      )}
    </button>
  );
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
