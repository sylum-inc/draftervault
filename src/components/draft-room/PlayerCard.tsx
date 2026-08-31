import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Player } from '@/services/auctionDraftService';
import { researchMark } from '@/services/playerResearch';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';

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
  watched,
  pinned,
  onSelect,
  onToggleWatch,
  onTogglePin,
  gainLow,
  gainHigh,
  gainFree,
  gainSlot,
}: PlayerCardProps) => {
  const identity = getIdentity(player.id);
  const mark = researchReady ? researchMark(player.id) : null;
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);

  const percentiles = player.percentiles ?? {};
  const usage = player.usage;
  const edge = player.market?.edge ?? null;

  // Receivers and backs earn their touches differently, so the card shows the
  // measure that actually describes the role rather than a fixed trio.
  const signals: Array<{ label: string; value: string; percentile?: number; title: string }> = [];
  if (player.snapPercentage != null) {
    signals.push({
      label: 'Snaps',
      value: `${Math.round(player.snapPercentage)}%`,
      percentile: percentiles.snapShare,
      title: `${Math.round(player.snapPercentage)}% of offensive snaps${percentiles.snapShare != null ? ` — ${percentiles.snapShare}th percentile among ${player.position}s` : ''}`,
    });
  }
  if (usage?.targetShare != null && player.position !== 'RB') {
    signals.push({
      label: 'Tgt%',
      value: `${usage.targetShare}%`,
      percentile: percentiles.targetShare,
      title: `${usage.targetShare}% of his team's targets${percentiles.targetShare != null ? ` — ${percentiles.targetShare}th percentile` : ''}`,
    });
  } else if (usage?.carryShare != null) {
    signals.push({
      label: 'Car%',
      value: `${usage.carryShare}%`,
      percentile: percentiles.carryShare,
      title: `${usage.carryShare}% of his team's carries${percentiles.carryShare != null ? ` — ${percentiles.carryShare}th percentile` : ''}`,
    });
  }
  if (usage?.redZoneTouches) {
    signals.push({
      label: 'RZ',
      value: String(usage.redZoneTouches),
      percentile: percentiles.redZoneTouches,
      title: `${usage.redZoneTouches} red-zone touches in ${usage.season}${percentiles.redZoneTouches != null ? ` — ${percentiles.redZoneTouches}th percentile` : ''}`,
    });
  }

  /*
   * Where the projection sits inside his own floor-to-ceiling range.
   *
   * A number for the projection says what he is expected to score; this says
   * what *kind* of player he is. Two backs projected at 240 are not the same
   * bid when one runs 210-260 and the other 150-380, and nothing on the board
   * said so — the range was in the profile, behind two clicks nobody makes
   * while a name is being called. Position on the track is the skew: left of
   * centre is a ceiling play, right of centre is a floor play.
   */
  const spread = player.upside - player.floor;
  const skew = spread > 0 ? ((player.projectedPoints - player.floor) / spread) * 100 : 50;

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
  if (player.durability && player.durability.totalMissed >= 4) {
    risks.push({
      label: `${player.durability.totalMissed} gms missed`,
      tone: 'warn',
      title: player.durability.reported.length
        ? player.durability.reported.map((r) => `${r.part} (${r.weeks}w)`).join(', ')
        : `${player.durability.totalMissed} games missed across the last three seasons`,
    });
  }
  if (player.recentTrends !== 'STABLE') {
    risks.push({
      label: player.recentTrends === 'RISING' ? 'rising' : 'declining',
      tone: player.recentTrends === 'RISING' ? 'good' : 'bad',
      title: `Recent production is ${player.recentTrends.toLowerCase()}`,
    });
  }

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
          title={`Floor ${player.floor} · projected ${player.projectedPoints} · ceiling ${player.upside} — one standard deviation either side of the season total`}
        >
          <span className="dr-num dr-card-range-end">{player.floor}</span>
          <span className="dr-card-range-track" aria-hidden="true">
            <span className="dr-card-range-mark" style={{ left: `${skew}%` }} />
          </span>
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
          <span
            title={`${player.injuryRisk.toLowerCase()} injury risk, from games actually missed`}
          >
            <em>risk</em>
            <b style={{ color: RISK_COLOR[player.injuryRisk] }}>
              {player.injuryRisk.slice(0, 3).toLowerCase()}
            </b>
          </span>
        </div>
      )}

      {/* The three numbers that explain the projection, each with its standing
          in the position — a share means nothing without one. */}
      <div className="dr-card-signals">
        {(player.marketOnly ? [] : signals).map((signal) => (
          <span className="dr-card-signal" key={signal.label} title={signal.title}>
            <em>{signal.label}</em>
            <span className="dr-num">{signal.value}</span>
            <span
              className="dr-card-signal-bar"
              aria-hidden="true"
              style={{ width: `${signal.percentile ?? 0}%` }}
            />
            <span className="dr-card-signal-pct">{signal.percentile ?? '—'}</span>
          </span>
        ))}
      </div>

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
                {gainHigh > 0 ? '+' : ''}
                {gainLow === gainHigh ? gainHigh : `${gainLow}–${gainHigh}`}
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
