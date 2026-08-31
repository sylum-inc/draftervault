import type { CSSProperties } from 'react';
import type {
  BidCheck,
  BidCompetition,
  DraftAnalytics,
  DraftPhase,
  Player,
  SnakeGain,
  SnakeSlot,
  Team,
} from '@/services/auctionDraftService';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { modelCaveats } from '@/lib/modelTrust';
import { Headshot } from './Headshot';
import { RangeBar } from './charts/RangeBar';

interface NominationStageProps {
  /**
   * What buying him gains over the man the snake hands you free at his
   * position, and who that man is. Null when it cannot honestly be computed.
   *
   * The number this format actually turns on. `vorp` two tiles over measures
   * him against the last man the *league* rosters, which is the right bar only
   * when the auction buys the whole roster — here the alternative is whoever
   * survives to your own snake slot, and the two can differ by a hundred points.
   */
  snakeGain?: SnakeGain | null;
  /**
   * The same gain bounded across every draw, when the order is not yet drawn.
   *
   * Only one of the two is ever set: an exact number and a range beside it
   * would be two answers to one question. The range is not an estimate — both
   * ends are numbers `snakeGain` itself would print at some seat.
   */
  snakeBounds?: { low: SnakeGain; high: SnakeGain } | null;
  /**
   * What the web said about the man the snake would hand you instead.
   *
   * The gain above is a *difference* against one named player, and the model
   * knows only what he has done. Josh Jacobs is the free back this whole
   * format's arithmetic rests on and he is under an NFL review that could
   * suspend him; George Kittle is the free tight end and he tore an Achilles
   * in January. Both are in `research.json`, sourced and dated, and neither
   * reached the one number they move — because nothing joined the two
   * registers at the point a bid is decided.
   *
   * A fact with a source, so it belongs here beside the other facts rather
   * than in the advisor's box. It carries no number, exactly as the research
   * contract has no price field: it says which way the gain is soft, not what
   * to bid.
   */
  freeManResearch?: { direction: 'PAY_UP' | 'FADE' | 'NEUTRAL'; headline: string } | null;

  /**
   * Which half of the draft this stage is running, and the structural branch
   * of the whole component.
   *
   * It is deliberately the *only* phase-shaped prop. Two panels of controls
   * that differ in what they ask for — a price, or nothing at all — is one
   * decision, and splitting it across a second flag is how the bid box comes
   * back for a pick that has no price. Everything else here is a plain fact
   * that one mode or the other happens to use.
   */
  mode: DraftPhase;
  player: Player | null;
  teams: Team[];
  teamId: string;
  bid: string;
  analytics: DraftAnalytics | null;
  /**
   * Whether this transaction is legal. The engine answers it for both halves in
   * the same typed shape — `validateBid` in the auction, `validateSnakePick` in
   * the snake — and this renders whichever came back verbatim.
   */
  check: BidCheck | null;
  onTeamChange: (teamId: string) => void;
  onBidChange: (bid: string) => void;
  /** Sell at the bid, or take the pick. The room decides which by phase. */
  onConfirm: () => void;
  onOpenProfile: () => void;
  /** Whether a team still has room; a full one cannot win the bidding. */
  canDraft: (team: Team) => boolean;
  /** Whose turn it is in the snake, with the round and pick it falls on. */
  onTheClock?: SnakeSlot;
  /**
   * Sheet players still to sell or be passed over. Null when no sheet is in
   * force, which is also when there is no snake phase to count down to.
   */
  sheetRemaining: number | null;
  /**
   * Nobody bid a dollar. Marks the player passed over rather than striking him
   * off, which is what eventually ends the auction — one player nobody calls
   * would otherwise hold the room in an auction the table left long ago.
   */
  onUnsold: () => void;
  /** Put a player the room passed over back up for bidding. */
  onReturnToSheet: () => void;
  /** Whether this player has already been passed over. */
  passedOver: boolean;
  /**
   * What he costs at tonight's prices, and the multiplier that got there.
   *
   * The list price is what the board was built at; this is what the money still
   * in the room says it is worth now. Both are printed, because a bidder
   * arguing with the room needs the number they are arguing with. Null in the
   * snake, where nothing is being bought.
   */
  adjusted: number | null;
  inflation: number;
  /**
   * Who can legally beat the bid on the table.
   *
   * Facts, every dollar of it from the engine's `spendableFor` — the same call
   * `validateBid` makes. Nothing here is a guess about whether they *would*;
   * that is the advisor's, in its own box.
   */
  competition: BidCompetition | null;
}

const inkFor = (hex: string): string => {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0b0f17' : '#ffffff';
};

/**
 * How this bid compares to the model's number, in plain words.
 *
 * `snakeGain` is not a second opinion about the price, it is which question the
 * price is answering. The value is the *league's* bar — points over the last
 * man the league rosters — and it stays true of a player whose seat on your own
 * roster is already covered. What stops being true is that beating it is a
 * reason to bid.
 *
 * Two ways a seat is covered, and this format produces both constantly. He is
 * bench only, because your slots and flex are full and the snake hands you
 * eleven bench bodies for nothing. Or the gain is not positive, because the
 * best man left free at that seat outscores him — the stage was found saying
 * “Buying him gains −35 pts over Jonathan Taylor, free in the snake” with a
 * green “Below value” an inch above the sold button. Both sentences were true;
 * the screen was wrong, because green next to a bid box is an argument to buy
 * and there was none.
 *
 * So the tone is withheld rather than the words changed: the comparison still
 * says what it says, in the colour of something that is not an argument.
 */
const verdictFor = (
  bid: number,
  analytics: DraftAnalytics | null,
  snakeGain: SnakeGain | null | undefined
): { label: string; tone: string; note: string | null } => {
  if (!analytics || !Number.isFinite(bid) || bid < 1)
    return { label: '\u2014', tone: 'var(--dr-ink-muted)', note: null };
  const value = analytics.adjustedValue;
  const base =
    bid <= value * 0.85
      ? { label: 'Below value', tone: 'var(--dr-value)' }
      : bid <= value * 1.05
        ? { label: 'At value', tone: 'var(--dr-ink)' }
        : bid <= analytics.maxBid
          ? { label: 'Premium', tone: 'var(--dr-caution)' }
          : { label: 'Overpay', tone: 'var(--dr-danger)' };

  // An overpay is already saying don't; leave the loudest warning alone. And
  // with no gain computable there is nothing to qualify it with.
  if (!snakeGain || base.label === 'Overpay') return { ...base, note: null };

  if (snakeGain.slot === 'bench')
    return {
      label: base.label,
      tone: 'var(--dr-ink-muted)',
      note: 'to the league \u2014 not to your lineup',
    };
  if (snakeGain.gain <= 0)
    return {
      label: base.label,
      tone: 'var(--dr-ink-muted)',
      note: 'to the league \u2014 the snake hands you better, free',
    };
  return { ...base, note: null };
};

export const NominationStage = ({
  mode,
  player,
  teams,
  teamId,
  bid,
  analytics,
  check,
  onTeamChange,
  onBidChange,
  onConfirm,
  onOpenProfile,
  canDraft,
  onTheClock,
  snakeGain,
  snakeBounds,
  freeManResearch,
  sheetRemaining,
  onUnsold,
  onReturnToSheet,
  passedOver,
  adjusted,
  inflation,
  competition,
}: NominationStageProps) => {
  const snake = mode === 'snake';

  if (!player) {
    return (
      <section className="dr-panel dr-stage is-empty" aria-label="Nomination">
        {snake && onTheClock && (
          <p className="dr-eyebrow" style={{ marginBottom: 8 }}>
            {/* Both numbers, because they diverge and each is the answer to a
                different question. `pick` is the seat on the printed board;
                `overall` is what somebody at the table actually calls out. A
                team that filled its roster at auction still owns its seat, so
                with two teams bought out the opening pick of the snake sits in
                seat three — and nobody calls that pick three. */}
            Round {onTheClock.round}, pick {onTheClock.pick} · #{onTheClock.overall} overall ·{' '}
            {onTheClock.team.name} on the clock
          </p>
        )}
        <p className="dr-empty">
          {snake ? (
            <>
              The auction is over. Pick a player from the board to hand him to the team on the
              clock.
              <br />
              Nothing costs anything from here.
            </>
          ) : (
            <>
              Pick a player from the board to put them up for auction.
              <br />
              Their valuation and bid controls appear here.
            </>
          )}
        </p>
      </section>
    );
  }

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);
  const amount = Number.parseInt(bid, 10);
  const verdict = verdictFor(amount, analytics, snakeGain);
  const rejection = check && !check.ok ? check : null;

  const style = { '--dr-accent': primary, '--dr-accent-ink': inkFor(primary) } as CSSProperties;
  const step = (delta: number) =>
    onBidChange(String(Math.max(1, (Number.parseInt(bid, 10) || 0) + delta)));

  return (
    <section
      className="dr-panel dr-stage"
      style={style}
      aria-label={snake ? `Snake pick: ${player.name}` : `Nomination: ${player.name}`}
    >
      {snake && onTheClock && (
        <p className="dr-stage-clock">
          <span className="dr-eyebrow">
            Round {onTheClock.round} · pick {onTheClock.pick} · #{onTheClock.overall} overall
          </span>
          <strong>{onTheClock.team.name}</strong>
          <span className="dr-eyebrow">on the clock</span>
        </p>
      )}

      <div className="dr-stage-hero">
        {logo && <img className="dr-stage-logo" src={logo} alt="" aria-hidden="true" />}
        <Headshot
          identity={identity}
          fallbackName={player.name}
          width={208}
          className="dr-stage-photo"
        />
        <div>
          <h2 className="dr-stage-name">{identity?.name ?? player.name}</h2>
          <p className="dr-stage-sub">
            <span className="dr-pos">{player.position}</span>
            {team}
            {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
            {identity?.age && <span className="dr-num">{identity.age}y</span>}
            {/* Where the backtest found this board least reliable, said at the
                moment money is on the table rather than only in the browsing
                panel. `npm run backtest` scores the model against three
                held-out seasons of real draft-market ADP and the market wins
                on what a bid buys, so the price two tiles down is worth a
                caveat exactly here — a finding kept in a document is a finding
                nobody has while a name is being called. */}
            {modelCaveats(player).map((caveat) => (
              <span key={caveat.id} className="dr-bargain-caveat" title={caveat.detail}>
                {caveat.label}
              </span>
            ))}
          </p>
        </div>
      </div>

      <dl className="dr-stage-tiles">
        {/* Money in the auction, the board in the snake. A price and a ceiling
            are the two numbers that decide a bid; neither says anything about a
            pick that costs nothing, where the question is where he ranks and
            what he is projected to do. */}
        {snake ? (
          <>
            <div className="dr-tile">
              <dt>Our rank</dt>
              <dd style={{ color: 'var(--dr-value)' }}>#{player.adp}</dd>
            </div>
            <div className="dr-tile">
              <dt>Bye</dt>
              <dd>{player.byeWeek || '—'}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="dr-tile">
              <dt>Est. value</dt>
              <dd style={{ color: 'var(--dr-value)' }}>
                ${player.estimatedValue}
                {/* The list price is what the board was priced at; the second
                    number is what the money still in the room says it is worth
                    tonight. Printed together and both labelled, because a
                    single adjusted number with the multiplier hidden is a
                    number nobody can argue with — and arguing with it is the
                    job. Identical figures are not worth two lines. */}
                {adjusted != null && adjusted !== player.estimatedValue && (
                  <span
                    className="dr-tile-note"
                    title="List price restated at the room's inflation"
                  >
                    ${adjusted} at {inflation.toFixed(2)}×
                  </span>
                )}
              </dd>
            </div>
            <div className="dr-tile">
              <dt>Max bid</dt>
              <dd>${analytics ? Math.round(analytics.maxBid) : '—'}</dd>
            </div>
          </>
        )}
        {/* A market-only player carries placeholder zeroes because `Player`
            requires numbers here. This is the panel where money is decided, so
            it is the last place that may print one: "Projected 0" beside a bid
            box reads as a measurement, and the measurement does not exist. */}
        <div className="dr-tile">
          <dt>Projected</dt>
          <dd>{player.marketOnly ? '—' : player.projectedPoints}</dd>
        </div>
        <div className="dr-tile">
          <dt>VORP</dt>
          <dd>{player.marketOnly ? '—' : player.valueOverReplacement}</dd>
        </div>
      </dl>

      {/* What he adds to *your* lineup, not to a lineup in the abstract.
          Once your slots at his position are full he is competing for the flex,
          where the bar is the best free player from any flex position; once
          that is gone he is a bench body and adds nothing that scores, whatever
          his projection says. Quoting the position-level gain there is how a
          budget goes on a fourth running back. */}
      {!snakeGain && snakeBounds && !player.marketOnly && (
        <p className="dr-stage-snakegain" data-slot={snakeBounds.high.slot}>
          {snakeBounds.high.slot === 'bench' ? (
            <b style={{ color: 'var(--dr-danger)' }}>Bench only.</b>
          ) : snakeBounds.low.gain === snakeBounds.high.gain ? (
            <>
              Buying him gains{' '}
              <b
                style={{
                  color: snakeBounds.high.gain > 0 ? 'var(--dr-value)' : 'var(--dr-caution)',
                }}
              >
                {snakeBounds.high.gain > 0 ? '+' : ''}
                {snakeBounds.high.gain} pts
              </b>{' '}
              over {snakeBounds.high.free} ({snakeBounds.high.freePoints}), free in the snake —{' '}
              <b>at any draw</b>.
            </>
          ) : (
            <>
              Buying him gains{' '}
              <b
                style={{
                  color: snakeBounds.high.gain > 0 ? 'var(--dr-value)' : 'var(--dr-caution)',
                }}
              >
                {snakeBounds.low.gain > 0 ? '+' : ''}
                {snakeBounds.low.gain} to {snakeBounds.high.gain > 0 ? '+' : ''}
                {snakeBounds.high.gain} pts
              </b>{' '}
              over the free man — {snakeBounds.low.free} picking first, {snakeBounds.high.free}{' '}
              picking last.
            </>
          )}{' '}
          <span className="dr-stage-slot">{snakeBounds.high.note}</span>
          {/* The order has not been drawn, so this is a bound rather than a
              number: the true figure is one of the twelve and every one of them
              is inside it. Saying so is what keeps it from reading as an
              estimate somebody made — but only where it is actually a range.
              On a settled row the line already says "at any draw", and adding
              "this is the range" after it reads as a contradiction of the one
              thing that row is claiming. */}
          {snakeBounds.low.gain !== snakeBounds.high.gain && (
            <span className="dr-stage-slot">
              {' '}
              Snake order not drawn — this is the range across it.
            </span>
          )}
          {snakeBounds.high.free && freeManResearch && freeManResearch.direction !== 'NEUTRAL' && (
            <span
              className="dr-stage-freeflag"
              data-direction={freeManResearch.direction}
              title={freeManResearch.headline}
            >
              <b>{snakeBounds.high.free} is flagged:</b> {freeManResearch.headline} &mdash;{' '}
              {freeManResearch.direction === 'FADE'
                ? 'so the gain above may understate this bid.'
                : 'so the gain above may overstate this bid.'}
            </span>
          )}
        </p>
      )}

      {snakeGain && !player.marketOnly && (
        <p className="dr-stage-snakegain" data-slot={snakeGain.slot}>
          {snakeGain.slot === 'bench' ? (
            <b style={{ color: 'var(--dr-danger)' }}>Bench only.</b>
          ) : (
            <>
              Buying him gains{' '}
              <b style={{ color: snakeGain.gain > 0 ? 'var(--dr-value)' : 'var(--dr-caution)' }}>
                {snakeGain.gain > 0 ? '+' : ''}
                {snakeGain.gain} pts
              </b>{' '}
              over {snakeGain.free} ({snakeGain.freePoints}), free in the snake.
            </>
          )}{' '}
          <span className="dr-stage-slot">{snakeGain.note}</span>
          {snakeGain.free && freeManResearch && freeManResearch.direction !== 'NEUTRAL' && (
            <span
              className="dr-stage-freeflag"
              data-direction={freeManResearch.direction}
              title={freeManResearch.headline}
            >
              {/* Which way the gain is soft, and never by how much. A FADE on
                  the free man means he may do less than the projection this
                  difference was taken against, so the bid is worth more than
                  the number says — and the other way for a PAY_UP. */}
              <b>{snakeGain.free} is flagged:</b> {freeManResearch.headline} &mdash;{' '}
              <em>
                {freeManResearch.direction === 'FADE'
                  ? 'so the gain above may understate this bid.'
                  : 'so the gain above may overstate it.'}
              </em>
            </span>
          )}
        </p>
      )}

      {player.marketOnly && (
        <p className="dr-stage-marketonly">
          <strong>No projection.</strong> The pool has never heard of him — nflverse&rsquo;s roster
          file does not carry him yet. He is on the board because real drafts are taking him
          {player.customRanking?.rank
            ? ` around ${player.position}${player.customRanking.rank}`
            : ''}
          , and his price is whatever that rank buys on our curve. Every other number here would be
          invented, so none is shown.
        </p>
      )}

      <div className="dr-stage-range">
        {!player.marketOnly && (
          <RangeBar
            floor={player.floor}
            projection={player.projectedPoints}
            ceiling={player.upside}
            replacement={player.projectedPoints - player.valueOverReplacement || undefined}
          />
        )}
        <div className="dr-stage-signals" hidden={player.marketOnly}>
          {player.percentiles?.points != null && (
            <span title={`${player.percentiles.points}th percentile among ${player.position}s`}>
              <em>vs {player.position}</em>
              <strong className="dr-num">{player.percentiles.points}th</strong>
            </span>
          )}
          <span>
            <em>Consistency</em>
            <strong className="dr-num">{player.consistency ?? '—'}/10</strong>
          </span>
          <span>
            <em>Snap</em>
            <strong className="dr-num">
              {player.snapPercentage != null ? `${Math.round(player.snapPercentage)}%` : '—'}
            </strong>
          </span>
          <span>
            <em>Trend</em>
            <strong
              style={{
                color:
                  player.recentTrends === 'RISING'
                    ? 'var(--dr-value)'
                    : player.recentTrends === 'DECLINING'
                      ? 'var(--dr-danger)'
                      : 'var(--dr-ink-muted)',
              }}
            >
              {player.recentTrends === 'RISING'
                ? '▲'
                : player.recentTrends === 'DECLINING'
                  ? '▼'
                  : '–'}
            </strong>
          </span>
        </div>
      </div>

      {/*
        Who can still take him off you.

        Every figure here is a rule rather than a reading: `ceiling` is the
        engine's `spendableFor`, which is the same call `validateBid` runs, so
        nothing in this block can be a number the engine would then reject.
        That was the whole risk — a ceiling beside the bid box that turns out to
        be wrong is worse than no ceiling at all.

        After the reserve went to zero in this format these numbers are simply
        what a team has left, which is higher than the room reads. The panel
        exists because the opposite belief cost real players: an opponent who
        looked tapped out at $88 could still go to $96.

        What none of it says is whether they *would*. That is an estimate and
        it is in the advisor's dashed box, deliberately not here.
      */}
      {!snake && competition && (
        <div className="dr-outbid">
          <div className="dr-outbid-head">
            <span className="dr-eyebrow">
              {competition.currentBid > 0
                ? `Can beat $${competition.currentBid}`
                : 'Can bid on him'}
            </span>
            <span className="dr-outbid-caveat">what the rules allow</span>
          </div>

          {competition.rivals.length === 0 ? (
            <p className="dr-outbid-empty">
              Nobody else can.{' '}
              {competition.blocked > 0 && `${competition.blocked} have no room for him`}
              {competition.blocked > 0 && competition.outspent > 0 && '; '}
              {competition.outspent > 0 && `${competition.outspent} cannot reach the bid`}
              {(competition.blocked > 0 || competition.outspent > 0) && '.'}
            </p>
          ) : (
            <ul className="dr-outbid-list">
              {competition.rivals.slice(0, 5).map((rival) => (
                <li key={rival.team.id}>
                  <span className="dr-outbid-team">{rival.team.name}</span>
                  <span className="dr-num dr-outbid-ceiling">${rival.ceiling}</span>
                  <span className="dr-outbid-note">
                    {rival.need > 0
                      ? `${rival.need} ${player.position} slot${rival.need === 1 ? '' : 's'} open`
                      : `${rival.have} at ${player.position} already`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="dr-footnote">
            {competition.rivals.length > 5 && `${competition.rivals.length - 5} more can beat it. `}
            {!competition.mine
              ? 'Mark a team as yours in league settings to see your own ceiling here.'
              : !competition.mine.canRoster
                ? `You have no room for another ${player.position}.`
                : `You can go to $${competition.mine.ceiling}.`}
          </p>
        </div>
      )}

      <form
        className="dr-stage-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        {snake ? (
          // Nobody chooses a team in the snake: the order chose it, and offering
          // a select here would be offering a choice the engine will refuse.
          <p className="dr-verdict">
            <span>Goes to</span>
            <strong>{onTheClock?.team.name ?? '—'}</strong>
          </p>
        ) : (
          <div className="dr-field">
            <label className="dr-eyebrow" htmlFor="dr-team">
              Winning team
            </label>
            <select
              id="dr-team"
              className="dr-select"
              value={teamId}
              onChange={(event) => onTeamChange(event.target.value)}
            >
              <option value="">Select a team…</option>
              {teams.map((t) => {
                // A team with no room cannot win anything. It stays in the list
                // so the order never shifts under the cursor mid-auction, but it
                // says why it is unavailable rather than accepting the choice and
                // rejecting the bid afterwards.
                const full = !canDraft(t);
                return (
                  <option key={t.id} value={t.id} disabled={full}>
                    {t.name} · {full ? 'roster full' : `$${t.remaining} left`}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {!snake && (
          <div className="dr-field">
            <label className="dr-eyebrow" htmlFor="dr-bid">
              Winning bid
            </label>
            <div className="dr-bid">
              <button
                type="button"
                className="dr-step"
                onClick={() => step(-1)}
                aria-label="Lower bid by one dollar"
              >
                −
              </button>
              <input
                id="dr-bid"
                className="dr-input"
                inputMode="numeric"
                value={bid}
                onChange={(event) => onBidChange(event.target.value.replace(/[^0-9]/g, ''))}
              />
              <button
                type="button"
                className="dr-step"
                onClick={() => step(1)}
                aria-label="Raise bid by one dollar"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* A verdict against our number is a statement about a price. There is
            no price in the snake, so there is nothing to be above or below. */}
        {!snake && (
          <p className="dr-verdict">
            <span>Against our number</span>
            <strong style={{ color: verdict.tone }}>{verdict.label}</strong>
            {verdict.note && <em className="dr-verdict-note">{verdict.note}</em>}
          </p>
        )}

        {rejection && (
          <p className="dr-notice" role="status">
            {rejection.message}
          </p>
        )}

        {snake ? (
          <button
            // The auction hands focus to the winning-team select after a
            // nomination; the snake has no select, so the confirm button is
            // what the keyboard lands on and Enter still records the pick.
            id="dr-snake-draft"
            type="submit"
            className="dr-button dr-button-primary"
            disabled={!!rejection || !onTheClock}
          >
            Draft to {onTheClock?.team.name ?? 'nobody'}
          </button>
        ) : (
          <>
            <button
              type="submit"
              className="dr-button dr-button-primary"
              disabled={!!rejection || !teamId}
            >
              Sold — ${Number.isFinite(amount) ? amount : 0}
            </button>

            {/* The auction cannot end while one player nobody called is still
                waiting to be sold, and somebody has to be able to say so. It
                marks him passed over rather than striking him off, because the
                sheet's length is the league's auctioned count and shortening it
                would re-price the room mid-auction. Only for a player who is on
                the sheet: nobody bids on the other five hundred either, and
                there is nothing to pass over. */}
            {/* Passing a player over is the only control in the room that can
                end the auction, and it used to be one unconfirmed click with no
                way back: undo pops the pick log, so it takes back an unrelated
                sale instead, and a reset keeps the mark. A mis-click on the last
                unsold name ended the auction and left a $54 player to be taken
                for nothing. So the inverse is offered in the same slot, and the
                click that ends the auction asks first. */}
            {sheetRemaining != null && player.onSheet && !passedOver && (
              <button
                type="button"
                className="dr-button"
                onClick={() => {
                  if (
                    sheetRemaining > 1 ||
                    window.confirm(
                      `${player.name} is the last name on the sheet. Passing him over ends the auction and opens the snake draft.`
                    )
                  ) {
                    onUnsold();
                  }
                }}
                style={{ justifyContent: 'center' }}
                title="Mark him passed over — he goes to the snake instead"
              >
                Nobody bid · {sheetRemaining} left on the sheet
              </button>
            )}
            {player.onSheet && passedOver && (
              <button
                type="button"
                className="dr-button"
                onClick={onReturnToSheet}
                style={{ justifyContent: 'center' }}
                title="The room came back to him — put him up for bidding again"
              >
                Put him back up
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className="dr-button"
          onClick={onOpenProfile}
          style={{ justifyContent: 'center' }}
        >
          Full profile
        </button>
      </form>
    </section>
  );
};
