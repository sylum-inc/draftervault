import type { CSSProperties, ReactNode } from 'react';
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
import { getIdentity, teamColors } from '@/services/nflIdentity';
import { accentFor, inkFor } from '@/lib/accent';
import { modelCaveats } from '@/lib/modelTrust';
import { Headshot } from './Headshot';

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
  /**
   * The dossier, rendered by the room and handed in whole.
   *
   * Every tab of the player's detail plus the live "Tonight" tab, so the block
   * is the comprehensive view rather than a strip of six numbers with the
   * comprehensive view a click away. The room builds it because it owns every
   * input the live tab reads; the stage only decides where it goes — beside the
   * controls, in the column that scrolls, so the controls never move.
   */
  dossier?: ReactNode;
  /** Fold the dossier away to a single strip, for a small window or a quiet moment. */
  folded?: boolean;
  onToggleFold?: () => void;
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
  /**
   * Which of the twelve is the owner's, so the row can mark it.
   *
   * `teamId` is the *recording* control — it names whoever just bought a
   * player and sits on an opponent most of the night — and four panels have
   * already been caught presenting that as the owner's own. The row shows both
   * at once and must not confuse them: pressed is who won, marked is you.
   */
  myTeamId?: string | null;
  /**
   * The most he is worth, given everything else this budget could buy.
   *
   * The plan's number rather than a multiplier on his price — see
   * `src/lib/rosterPlan.ts` for why a multiplier could never be one. Null when
   * a plan cannot honestly be computed: no sheet, no team marked as yours, or
   * no snake order drawn, which are the same refusals the outlook makes.
   */
  walkAway?: number | null;
  /** What the rest of the money is already promised to, so a low ceiling says why. */
  planNames?: string[];
  /**
   * Whether this team may win this player at this price, from the engine.
   *
   * The row asks `validateBid` — the same call that runs when the button is
   * pressed — rather than approximating it, so a chip the room reads as live is
   * a sale the engine will take. It is the principle `getBidCompetition`
   * already lives by: a number read off the screen that the engine then refuses
   * is worse than no number at all.
   *
   * The two rejections it distinguishes are the two that mean different things
   * to somebody about to press. A full roster or a full position is structural
   * — no price makes it legal, so the button is disabled. Money that cannot
   * reach the bid is not: they may still take him, just not at this number, so
   * the chip dims and the row becomes the answer to "who can still outbid me".
   */
  checkTeam?: (teamId: string, amount: number) => BidCheck | null;
}

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
  dossier,
  folded = false,
  onToggleFold,
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
  myTeamId = null,
  walkAway = null,
  planNames = [],
  checkTeam,
}: NominationStageProps) => {
  const snake = mode === 'snake';

  if (!player) {
    // One line, across the width. Nothing is being decided, so the band has
    // nothing to hold — and a two-hundred-pixel empty panel across the top of
    // the board is the board paying for a message.
    return (
      <section className="dr-panel dr-stage dr-stage-empty is-empty" aria-label="Nomination">
        {snake && onTheClock && (
          <p className="dr-eyebrow" style={{ margin: 0 }}>
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
        <p className="dr-empty" style={{ margin: 0, padding: 0 }}>
          {snake
            ? 'The auction is over — pick a player from the board to hand him to the team on the clock. Nothing costs anything from here.'
            : 'Pick a player from the board to put him up for auction. His valuation and the bid controls appear here.'}
        </p>
      </section>
    );
  }

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const amount = Number.parseInt(bid, 10);
  const verdict = verdictFor(amount, analytics, snakeGain);
  const rejection = check && !check.ok ? check : null;

  const style = {
    '--dr-accent': primary,
    '--dr-accent-ink': inkFor(primary),
    '--dr-accent-lift': accentFor(primary),
  } as CSSProperties;
  const step = (delta: number) =>
    onBidChange(String(Math.max(1, (Number.parseInt(bid, 10) || 0) + delta)));

  const gain = snakeGain ?? snakeBounds?.high ?? null;
  const gainLow = snakeBounds && !snakeGain ? snakeBounds.low : null;

  return (
    <section
      className="dr-panel dr-stage"
      style={style}
      data-mode={snake ? 'snake' : 'auction'}
      data-folded={folded || !dossier ? '' : undefined}
      aria-label={snake ? `Snake pick: ${player.name}` : `Nomination: ${player.name}`}
    >
      {/*
        One strip across the top: who he is, the six numbers a bid is decided
        on, and the one sentence that decides it. Under it, the dossier down the
        left with the live tab first, and the controls down the right in a
        column whose height the dossier cannot change.

        It was three columns before — who, what he is worth, what am I doing
        about it — and the middle one was a 172px window onto prose with two
        hundred pixels of nothing under it, while the whole of what the board
        knows about him sat behind a "Full profile" button. The controls not
        moving was the right rule and it is kept; the emptiness was the price
        of keeping it badly.
      */}
      <div className="dr-stage-top">
        <div className="dr-stage-hero">
          <Headshot
            identity={identity}
            fallbackName={player.name}
            width={124}
            className="dr-stage-photo"
          />
          <div className="dr-stage-idblock">
            <h2 className="dr-stage-name">{identity?.name ?? player.name}</h2>
            <p className="dr-stage-sub">
              <span className="dr-pos">{player.position}</span>
              {team}
              {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
              {identity?.age && <span className="dr-num">{identity.age}y</span>}
              {!player.onSheet && player.sheetIsStated && (
                <span
                  className="dr-snake"
                  title="Not on the auction sheet — he comes up in the snake"
                >
                  snake
                </span>
              )}
              {passedOver && <span className="dr-snake">passed over</span>}
              {/* Where the backtest found this board least reliable, said at the
                moment money is on the table rather than only in the browsing
                panel. A finding kept in a document is a finding nobody has while
                a name is being called. */}
              {modelCaveats(player).map((caveat) => (
                <span key={caveat.id} className="dr-bargain-caveat" title={caveat.detail}>
                  {caveat.label}
                </span>
              ))}
            </p>
          </div>
          {snake && onTheClock && (
            <p className="dr-stage-clock">
              <span className="dr-eyebrow">
                Round {onTheClock.round} · pick {onTheClock.pick} · #{onTheClock.overall} overall
              </span>
              <strong>{onTheClock.team.name}</strong>
              <span className="dr-eyebrow">on the clock</span>
            </p>
          )}
          {dossier && onToggleFold && (
            <button
              type="button"
              className="dr-stage-fold"
              onClick={onToggleFold}
              aria-pressed={folded}
              title={folded ? 'Show the dossier' : 'Fold the dossier away'}
            >
              {folded ? '▾ Dossier' : '▴ Fold'}
            </button>
          )}
        </div>

        <dl className="dr-stage-tiles">
          {snake ? (
            <>
              <div className="dr-tile">
                <dt>Our rank</dt>
                <dd>#{player.adp}</dd>
              </div>
              <div className="dr-tile">
                <dt>Bye</dt>
                <dd>{player.byeWeek || '—'}</dd>
              </div>
            </>
          ) : (
            <>
              <div className="dr-tile">
                <dt>List</dt>
                <dd className="is-price">${player.estimatedValue}</dd>
              </div>
              {/* What the money still in the room says he is worth tonight,
                  beside the list price it moved. Both printed and both labelled,
                  because a single adjusted number with the multiplier hidden is
                  a number nobody can argue with — and arguing with it is the job. */}
              <div className="dr-tile" title="List price restated at the room's inflation">
                <dt>Tonight</dt>
                <dd>
                  {adjusted == null || player.marketOnly ? '—' : `$${adjusted}`}
                  {adjusted != null && !player.marketOnly && (
                    <span className="dr-tile-note">{inflation.toFixed(2)}×</span>
                  )}
                </dd>
              </div>
              {/*
                The plan's own answer to what he is worth to this roster — the
                price above which the same money buys more somewhere else. Not a
                multiplier on his price: see `src/lib/rosterPlan.ts` for why a
                multiplier could never be one. Amber only when the bid on the
                table has gone past it, because a walk-away below list is most
                of a commissioner's sheet and a warning that is always on is
                not a warning.
              */}
              <div
                className="dr-tile"
                title={
                  walkAway == null
                    ? 'Needs a sheet and a team marked as yours — without them, what a dollar is worth cannot be computed.'
                    : walkAway === 0
                      ? planNames.length
                        ? `Every dollar is already promised to ${planNames.join(', ')}. He is worth bidding on the moment one of them goes to somebody else.`
                        : 'Your roster cannot carry him at all — no price makes this legal.'
                      : `Past $${walkAway} the same money buys more elsewhere on the sheet.`
                }
              >
                <dt>Walk away</dt>
                <dd
                  className="is-walk"
                  data-tone={
                    walkAway != null && Number.isFinite(amount) && amount > walkAway
                      ? 'bad'
                      : undefined
                  }
                >
                  {walkAway == null ? '—' : `$${walkAway}`}
                </dd>
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
          {/* The number this format turns on, where it is knowable: points over
              the man the snake hands you free at the seat he would take. A range
              where the order has not been drawn, because both ends are numbers
              this same call would print at some seat. */}
          <div
            className="dr-tile"
            title={
              gain
                ? gain.slot === 'bench'
                  ? 'Your seats at his position and your flex are full — he adds nothing that scores.'
                  : `Over ${gain.free ?? 'the free man'}, free in the snake — ${gain.note}`
                : 'Needs a sheet and a team marked as yours.'
            }
          >
            <dt>Over free</dt>
            <dd
              className="is-gain"
              data-tone={
                !gain || player.marketOnly
                  ? undefined
                  : gain.slot === 'bench'
                    ? 'bad'
                    : gain.gain > 0
                      ? 'good'
                      : 'warn'
              }
            >
              {!gain || player.marketOnly
                ? '—'
                : gain.slot === 'bench'
                  ? 'bench'
                  : gainLow && gainLow.gain !== gain.gain
                    ? `${gainLow.gain > 0 ? '+' : ''}${gainLow.gain}…${gain.gain > 0 ? '+' : ''}${gain.gain}`
                    : `${gain.gain > 0 ? '+' : ''}${gain.gain}`}
            </dd>
          </div>
        </dl>

        {/* The sentence the tiles abbreviate, always visible whatever tab is
            open below: what a bid buys, over whom, into which seat — and what
            the web said about the man it is measured against. */}
        <div className="dr-stage-line">
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
              {snakeBounds.high.free &&
                freeManResearch &&
                freeManResearch.direction !== 'NEUTRAL' && (
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
                  <b
                    style={{ color: snakeGain.gain > 0 ? 'var(--dr-value)' : 'var(--dr-caution)' }}
                  >
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
              <strong>No projection.</strong> The pool has never heard of him — nflverse&rsquo;s
              roster file does not carry him yet. He is on the board because real drafts are taking
              him
              {player.customRanking?.rank
                ? ` around ${player.position}${player.customRanking.rank}`
                : ''}
              , and his price is whatever that rank buys on our curve. Every other number here would
              be invented, so none is shown.
            </p>
          )}
        </div>
      </div>

      {dossier && !folded && <div className="dr-stage-dossier">{dossier}</div>}

      <form
        className="dr-stage-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
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

        {snake ? (
          // Nobody chooses a team in the snake: the order chose it, and offering
          // a select here would be offering a choice the engine will refuse.
          <p className="dr-verdict">
            <span>Goes to</span>
            <strong>{onTheClock?.team.name ?? '—'}</strong>
          </p>
        ) : (
          <div className="dr-field">
            <label className="dr-eyebrow" id="dr-team-label">
              Winning team
            </label>
            {/*
             * Twelve buttons, not a dropdown.
             *
             * This is the highest-frequency act of the night — sixty times,
             * while somebody shouts a number across a room — and it was a
             * `<select>` of twelve options all beginning with the word "Team".
             * Typeahead is therefore useless (every option matches the same
             * letter), so reaching team nine was nine arrow presses or a mouse
             * trip into a dropdown that covers the board. Measured: nine.
             *
             * A dropdown is the control for a list too long to show. Twelve is
             * a row. Showing them costs one line of the band and buys three
             * things: the choice is one click, the budgets are legible without
             * opening anything, and the row doubles as the readout for who can
             * still bid — which is the question being asked at exactly this
             * moment and was previously a sentence underneath.
             *
             * A team with no room stays in place rather than disappearing,
             * because a row that reorders under the cursor mid-auction is worse
             * than a disabled button; it says why instead.
             */}
            <div className="dr-teamrow" role="group" aria-labelledby="dr-team-label">
              {teams.map((t) => {
                const verdict = checkTeam?.(t.id, amount) ?? null;
                const blocked =
                  verdict && !verdict.ok
                    ? verdict.code === 'roster-full' || verdict.code === 'position-full'
                    : null;
                // Falls back to the roster question alone where no checker was
                // handed down, which is what the control asked before.
                const full = blocked ?? !canDraft(t);
                const short = !full && verdict != null && !verdict.ok;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="dr-teamchip"
                    aria-pressed={teamId === t.id}
                    disabled={full}
                    data-short={short ? '' : undefined}
                    data-mine={t.id === myTeamId ? '' : undefined}
                    title={
                      verdict && !verdict.ok
                        ? `${t.name} — ${verdict.message}`
                        : `${t.name} — $${t.remaining} left`
                    }
                    onClick={() => onTeamChange(teamId === t.id ? '' : t.id)}
                  >
                    <em>{t.name}</em>
                    <b className="dr-num">{full ? 'full' : `$${t.remaining}`}</b>
                  </button>
                );
              })}
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
                title={`Mark him passed over — he goes to the snake instead. ${sheetRemaining} left on the sheet.`}
              >
                Nobody bid
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

        {/* Under the button rather than above it: a notice that appeared between
            the verdict and SOLD pushed the button thirty pixels at the exact
            moment of a mis-press, which is the moment a hand is already moving. */}
        {rejection && (
          <p className="dr-notice" role="status">
            {rejection.message}
          </p>
        )}
        {!snake && !rejection && !teamId && (
          <p className="dr-stage-hint" role="status">
            Pick the winning team to sell.
          </p>
        )}
      </form>
    </section>
  );
};
