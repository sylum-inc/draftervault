import type { ReactNode } from 'react';
import type {
  BidCompetition,
  DraftPhase,
  InflationBasis,
  MarketState,
  Player,
  PositionPulse,
  SnakeGain,
  SnakeSlot,
  Team,
} from '@/services/auctionDraftService';
import type { RosterPlan, PlayerValue } from '@/lib/rosterPlan';
import type { Endgame } from '@/lib/endgame';
import { groupRoomRead, type RoomRead } from '@/services/draftAdvisor';
import type { ResearchMark } from '@/services/playerResearch';
import { getIdentity } from '@/services/nflIdentity';
import { RunTape, Shelf, SlotFit } from './charts/micro';
import { PriceChain, type ChainStep } from './charts/profile';

/**
 * What one bid on this player does to *your* draft tonight, in the state the
 * room is in right now.
 *
 * The dossier behind the other tabs is about the player and reads the same at
 * pick one and pick a hundred and fifty. Everything in here is about the
 * player *in this room* and moves with every sale: the seat he would take on
 * your roster, the free man he is measured against, what the plan says the
 * marginal dollar is worth, who can still take him off you, how fast his
 * position is going, and what the money in the room is doing. None of it is
 * new arithmetic — every figure is one the engine already computes and the
 * side panels already print for the room as a whole. What is new is that they
 * are gathered around the one name being called, at the moment it is called,
 * because a reading that lives in a panel two tabs away is a reading nobody
 * has with money on the table.
 *
 * It is a facts tab. The one opinion in it — what rivals would *plausibly* pay
 * — sits inside the same dashed box the advisor uses everywhere else, so the
 * register is never in doubt.
 */
export interface SpotlightTonightProps {
  player: Player;
  mode: DraftPhase;
  /** The bid typed so far, parsed; NaN or 0 before a number is entered. */
  bid: number;
  myTeam: Team | undefined;
  /** Your own drafted players at his position, in pick order. */
  myAtPosition: Player[];
  snakeGain: SnakeGain | null;
  snakeBounds: { low: SnakeGain; high: SnakeGain } | null;
  research: ResearchMark | null;
  walkAway: number | null;
  /** Gain, worth and seat at the plan's rate — bid board in the auction, pick board in the snake. */
  value: PlayerValue | null;
  plan: RosterPlan | null;
  adjusted: number | null;
  inflation: number;
  competition: BidCompetition | null;
  /** The advisor's read of who would actually go higher. Null with the advisor off. */
  room: RoomRead | null;
  pulse: PositionPulse | undefined;
  scarcity: MarketState['scarcity'][number] | undefined;
  basis: InflationBasis;
  endgame: Endgame;
  /** What the bid leaves you, from the engine's own reserve rules. */
  spend: {
    remaining: number;
    slotsLeft: number;
    minimumHold: number;
    affordable: Player | null;
    legal: boolean;
  } | null;
  onTheClock?: SnakeSlot;
  /** The best free picks right now, snake only, gain-ranked. */
  freePicks?: Array<{ player: Player; gain: number; seat: PlayerValue['seat'] }>;
}

const money = (value: number) => `$${Math.round(value)}`;
const signed = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)}`;

const Section = ({
  title,
  aside,
  children,
  wide,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) => (
  <section className={`dr-tonight-section${wide ? ' is-wide' : ''}`}>
    <header className="dr-tonight-head">
      <h3 className="dr-eyebrow">{title}</h3>
      {aside && <span className="dr-tonight-aside">{aside}</span>}
    </header>
    {children}
  </section>
);

/**
 * The seat he would take, said in one word each.
 *
 * `starter`, `flex` and `bench` are the engine's own classification, read
 * through the same `unfilledSlotsFor` the reserve uses; this only puts the
 * position's name on the seat so "RB2" reads as the seat it is.
 */
const seatWord = (
  position: string,
  slot: SnakeGain['slot'] | PlayerValue['seat'] | undefined,
  filled: number
) =>
  slot === 'bench' ? 'the bench' : slot === 'flex' ? 'your flex' : `your ${position}${filled + 1}`;

export const SpotlightTonight = ({
  player,
  mode,
  bid,
  myTeam,
  myAtPosition,
  snakeGain,
  snakeBounds,
  research,
  walkAway,
  value,
  plan,
  adjusted,
  inflation,
  competition,
  room,
  pulse,
  scarcity,
  basis,
  endgame,
  spend,
  onTheClock,
  freePicks = [],
}: SpotlightTonightProps) => {
  const snake = mode === 'snake';
  const gain = snakeGain ?? snakeBounds?.high ?? null;
  const inPlan = plan?.buy.find((entry) => entry.candidate.id === player.id) ?? null;
  const liveBid = Number.isFinite(bid) && bid >= 1 ? bid : null;
  const mine = research && research.direction !== 'NEUTRAL' ? research : null;

  /*
   * The price as the chain it is: list, tonight's room, then what the plan says
   * he is worth to *this* roster. The last step is the one that carries the
   * information — "the model likes him" and "you need one and the room is hot"
   * are different reasons to be looking at the same number, and only one of
   * them survives you filling the seat.
   */
  const chain: ChainStep[] = [];
  if (!snake && !player.marketOnly) {
    chain.push({
      label: 'List',
      dollars: player.estimatedValue,
      note: 'points over the last man the league rosters',
    });
    if (adjusted != null && Math.round(adjusted) !== player.estimatedValue) {
      chain.push({
        label: 'Tonight',
        dollars: Math.round(adjusted),
        applied: `×${inflation.toFixed(2)}`,
        note: 'restated at what the money still in the room says',
      });
    }
    if (walkAway != null) {
      chain.push({
        label: 'Walk away',
        dollars: walkAway,
        applied: inPlan
          ? 'in the plan'
          : plan && plan.perDollar > 0 && value && value.gain > 0
            ? `${Math.round(value.gain)} pts ÷ ${plan.perDollar.toFixed(2)} pts/$`
            : plan && plan.slack > 0
              ? 'the plan’s spare money'
              : undefined,
        note: inPlan
          ? `the plan pays ${money(inPlan.candidate.price)} for him`
          : value && value.gain > 0 && plan && plan.perDollar > 0
            ? 'what his points are worth at the rate the marginal dollar buys'
            : walkAway === 0
              ? plan && plan.buy.length
                ? `every dollar is promised to ${plan.buy.map((b) => b.candidate.name).join(', ')}`
                : 'your roster cannot carry him'
              : 'the most the best lineup has no other use for',
      });
    }
  }

  const rate = plan && plan.perDollar > 0 ? plan.perDollar : null;
  const bidRate = liveBid && value && value.gain > 0 ? value.gain / liveBid : null;

  return (
    <div className="dr-tabpanel dr-tonight" role="tabpanel" aria-label="Tonight">
      {player.marketOnly && (
        <p className="dr-tonight-verdict">
          <strong>No projection.</strong> The pool has never heard of him; every number below would
          be invented, so none is shown.
        </p>
      )}

      <div className="dr-tonight-grid">
        {/* ---- your seat -------------------------------------------------- */}
        <Section
          title="Your seat"
          aside={
            pulse
              ? `${pulse.slotsFilled}/${pulse.slotsTotal} ${player.position} seats${pulse.flexOpen ? ' · flex open' : ''}`
              : undefined
          }
        >
          {!myTeam ? (
            <p className="dr-empty">Mark a team as yours in league settings.</p>
          ) : (
            <>
              <div className="dr-tonight-seat">
                {pulse && (
                  <SlotFit
                    total={pulse.slotsTotal}
                    filled={pulse.slotsFilled}
                    flexOpen={pulse.flexOpen}
                    size={18}
                    label={`${pulse.slotsFilled} of ${pulse.slotsTotal} starting ${player.position} seats filled`}
                  />
                )}
                <p>
                  He would take{' '}
                  <strong>
                    {seatWord(player.position, gain?.slot ?? value?.seat, pulse?.slotsFilled ?? 0)}
                  </strong>
                  {gain?.free && gain.slot !== 'bench' && (
                    <>
                      {' '}
                      instead of <strong>{gain.free}</strong>
                      {gain.freePoints != null && (
                        <span className="dr-num"> · {gain.freePoints} pts</span>
                      )}
                    </>
                  )}
                  .
                </p>
              </div>
              {myAtPosition.length > 0 ? (
                <ul className="dr-tonight-list">
                  {myAtPosition.map((own) => (
                    <li key={own.id}>
                      <span className="dr-pos">{own.position}</span>
                      <span className="dr-tonight-name">
                        {getIdentity(own.id)?.name ?? own.name}
                      </span>
                      <span className="dr-num dr-tonight-right">
                        {own.draftCost != null ? money(own.draftCost) : 'snake'}
                      </span>
                      <span className="dr-num dr-tonight-right">{own.projectedPoints}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dr-footnote">You have nobody at {player.position} yet.</p>
              )}
            </>
          )}
        </Section>

        {/* ---- the price, worked ------------------------------------------ */}
        {!snake && !player.marketOnly && (
          <Section
            title="The price, worked"
            aside={rate ? `a dollar buys ${rate.toFixed(2)} pts` : undefined}
          >
            {chain.length ? <PriceChain steps={chain} /> : null}
            {liveBid != null && (
              <p
                className="dr-tonight-live"
                data-tone={
                  walkAway != null && liveBid > walkAway
                    ? 'bad'
                    : bidRate != null && rate != null && bidRate >= rate
                      ? 'good'
                      : 'muted'
                }
              >
                At <b className="dr-num">{money(liveBid)}</b>
                {bidRate != null && rate != null ? (
                  <>
                    {' '}
                    he buys <b className="dr-num">{bidRate.toFixed(2)}</b> pts a dollar against the
                    plan&rsquo;s <b className="dr-num">{rate.toFixed(2)}</b>
                    {walkAway != null && liveBid > walkAway
                      ? ` — past your walk-away of ${money(walkAway)}.`
                      : bidRate >= rate
                        ? ' — better than the money does elsewhere.'
                        : ' — the money buys more elsewhere on the sheet.'}
                  </>
                ) : walkAway != null && liveBid > walkAway ? (
                  <> — past your walk-away of {money(walkAway)}.</>
                ) : value && value.gain <= 0 ? (
                  <> — he adds nothing your lineup would start.</>
                ) : null}
              </p>
            )}
          </Section>
        )}

        {/* ---- the plan ---------------------------------------------------- */}
        {plan && !snake && (
          <Section
            title="The plan tonight"
            aside={`${money(plan.spend)} for ${signed(plan.gain)} pts`}
          >
            {plan.buy.length === 0 ? (
              <p className="dr-empty">Nothing on the sheet beats what the snake hands you.</p>
            ) : (
              <ul className="dr-tonight-list">
                {plan.buy.map((entry) => (
                  <li
                    key={entry.candidate.id}
                    className={entry.candidate.id === player.id ? 'is-him' : undefined}
                  >
                    <span className="dr-pos">{entry.candidate.position}</span>
                    <span className="dr-tonight-name">{entry.candidate.name}</span>
                    <span className="dr-num dr-tonight-right is-good">{signed(entry.gain)}</span>
                    <span className="dr-num dr-tonight-right">{money(entry.candidate.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="dr-footnote">
              {inPlan
                ? `He is in it, at ${money(inPlan.candidate.price)}.`
                : value && value.maxPrice > 0
                  ? `Not in it — but worth ${money(value.maxPrice)} at the plan’s rate, which is a real bid the moment one of these goes elsewhere.`
                  : 'Not in it, and the snake covers him.'}
              {plan.slack > 0 && ` ${money(plan.slack)} of the budget has no better use.`}
            </p>
          </Section>
        )}

        {/* ---- the snake's own board ------------------------------------- */}
        {/* The pick board is *your* lineup's, so it is shown when the pick is
            yours. With another team on the clock the gains would be about
            your seats under their name. */}
        {snake &&
          freePicks.length > 0 &&
          onTheClock &&
          myTeam &&
          onTheClock.team.id === myTeam.id && (
            <Section title="Best free picks now" aside="your pick">
              <ul className="dr-tonight-list">
                {freePicks.slice(0, 6).map((pick) => (
                  <li
                    key={pick.player.id}
                    className={pick.player.id === player.id ? 'is-him' : undefined}
                  >
                    <span className="dr-pos">{pick.player.position}</span>
                    <span className="dr-tonight-name">
                      {getIdentity(pick.player.id)?.name ?? pick.player.name}
                    </span>
                    <span className="dr-tonight-seatword">{pick.seat}</span>
                    <span className="dr-num dr-tonight-right is-good">{signed(pick.gain)}</span>
                  </li>
                ))}
              </ul>
              <p className="dr-footnote">
                Ranked by what each adds to the lineup on the clock, not by projection — with both
                back seats gone the pick is whoever has the widest gap to the next man for the flex.
              </p>
            </Section>
          )}

        {/* ---- who can take him ------------------------------------------- */}
        {!snake && competition && (
          <Section
            title={
              competition.currentBid > 0
                ? `Can beat ${money(competition.currentBid)}`
                : 'Can bid on him'
            }
            aside="what the rules allow"
          >
            {competition.rivals.length === 0 ? (
              <p className="dr-empty">
                Nobody else can.
                {competition.blocked > 0 && ` ${competition.blocked} have no room for him`}
                {competition.blocked > 0 && competition.outspent > 0 && ';'}
                {competition.outspent > 0 && ` ${competition.outspent} cannot reach the bid`}
                {(competition.blocked > 0 || competition.outspent > 0) && '.'}
              </p>
            ) : (
              <ul className="dr-tonight-list dr-tonight-rivals">
                {competition.rivals.slice(0, 6).map((rival) => (
                  <li key={rival.team.id}>
                    <span className="dr-tonight-name">{rival.team.name}</span>
                    <span className="dr-num dr-tonight-right">{money(rival.ceiling)}</span>
                    <span className="dr-tonight-why">
                      {rival.need > 0
                        ? `${rival.need} ${player.position} seat${rival.need === 1 ? '' : 's'} open`
                        : `${rival.have} at ${player.position} already`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="dr-footnote">
              {competition.rivals.length > 6 &&
                `${competition.rivals.length - 6} more can beat it. `}
              {!competition.mine
                ? 'Mark a team as yours to see your own ceiling.'
                : !competition.mine.canRoster
                  ? `You have no room for another ${player.position}.`
                  : `You can go to ${money(competition.mine.ceiling)}.`}
            </p>

            {/* The estimate, in the dashed box that marks every opinion in the
                room. A rule and a guess in one column is how somebody bids
                against a number nobody would say; the box is what keeps them
                apart while letting them sit on one screen. */}
            {room && (room.rivals.length > 0 || room.quiet > 0) && (
              <div className="dr-opinion" aria-label="Advisor — opinion, not a measurement">
                <span className="dr-advisor-badge">Advisor</span>
                <p className="dr-opinion-line">
                  {room.rivals.length === 0 ? (
                    'Nobody left has a reason to go higher.'
                  ) : (
                    <>
                      Expect it to reach about{' '}
                      <strong className="dr-num">{money(room.topPlausible)}</strong>
                      {' — '}
                      {groupRoomRead(room).map((group, index) => (
                        <span key={group.why}>
                          {index > 0 && '; '}
                          {group.names} at <b className="dr-num">{money(group.plausible)}</b>
                        </span>
                      ))}
                      .
                    </>
                  )}
                  {room.quiet > 0 && (
                    <span className="dr-tonight-note">
                      {' '}
                      {room.quiet} other{room.quiet === 1 ? '' : 's'} could but have no reason to.
                    </span>
                  )}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* ---- his position tonight -------------------------------------- */}
        {pulse && !player.marketOnly && (
          <Section
            title={`${player.position}s left`}
            aside={`${pulse.startable} startable of ${pulse.left}`}
          >
            <div className="dr-tonight-shelf">
              <Shelf
                shelf={pulse.shelf}
                mine={pulse.shelf.findIndex(
                  (points) => points === Math.round(player.projectedPoints)
                )}
                replacement={pulse.replacement}
                width={320}
                height={44}
                label={`${pulse.startable} ${player.position}s left above replacement`}
              />
              {pulse.window > 0 && (
                <RunTape
                  gone={pulse.goneRecently}
                  window={pulse.window}
                  width={320}
                  label={`${pulse.goneRecently} of the last ${pulse.window} picks were ${player.position}s`}
                />
              )}
            </div>
            <dl className="dr-tonight-facts">
              {scarcity && (
                <>
                  <div>
                    <dt>Seats to fill</dt>
                    <dd className="dr-num" data-squeeze={scarcity.squeeze}>
                      {scarcity.seatsLeft}
                      <span>/{scarcity.startableLeft}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>$ per seat</dt>
                    <dd className="dr-num">
                      {scarcity.moneyPerSeat == null ? '—' : money(scarcity.moneyPerSeat)}
                    </dd>
                  </div>
                  <div>
                    <dt>Cliff to 5th</dt>
                    <dd className="dr-num">{scarcity.cliff} pts</dd>
                  </div>
                  <div>
                    <dt>Tier one left</dt>
                    <dd className="dr-num">{scarcity.tierOneLeft}</dd>
                  </div>
                </>
              )}
              {pulse.window > 0 && (
                <div>
                  <dt>Last {pulse.window} picks</dt>
                  <dd
                    className="dr-num"
                    data-tone={pulse.goneRecently / pulse.window > 0.4 ? 'warn' : undefined}
                  >
                    {pulse.goneRecently} {player.position}
                    {pulse.goneRecently === 1 ? '' : 's'}
                  </dd>
                </div>
              )}
            </dl>
            {scarcity?.squeeze === 'high' && (
              <p className="dr-notice dr-notice-warn">
                The seats have caught the players left to fill them — somebody goes without.
              </p>
            )}
          </Section>
        )}

        {/* ---- the money in the room -------------------------------------- */}
        {!snake && (
          <Section title="The money in the room" aside={`${basis.inflation.toFixed(2)}×`}>
            <p className="dr-tonight-line">
              <b className="dr-num">{money(basis.moneyLeft)}</b> left chasing{' '}
              <b className="dr-num">{money(basis.valueLeft)}</b> of list value across{' '}
              {basis.forSaleLeft} still for sale.
            </p>
            <p className="dr-tonight-line" data-lean={endgame.lean}>
              {endgame.verdict}
            </p>
            <dl className="dr-tonight-facts">
              <div>
                <dt>Par</dt>
                <dd className="dr-num">{money(endgame.par)}</dd>
              </div>
              <div>
                <dt>Pace</dt>
                <dd className="dr-num">{endgame.pace == null ? '—' : money(endgame.pace)}</dd>
              </div>
              <div>
                <dt>Can cover par</dt>
                <dd className="dr-num">
                  {endgame.liveBidders}/{endgame.teamCount}
                </dd>
              </div>
              {endgame.yourMoney != null && endgame.yourShare != null && (
                <div>
                  <dt>Your share</dt>
                  <dd className="dr-num">{Math.round(endgame.yourShare * 100)}%</dd>
                </div>
              )}
            </dl>
          </Section>
        )}

        {/* ---- if he goes to you ------------------------------------------ */}
        {!snake && spend && liveBid != null && myTeam && (
          <Section title="If he goes to you" aside={`at ${money(liveBid)}`}>
            <dl className="dr-tonight-facts">
              <div>
                <dt>Left after</dt>
                <dd className="dr-num" data-tone={spend.legal ? undefined : 'bad'}>
                  {money(spend.remaining)}
                </dd>
              </div>
              <div>
                <dt>Seats to buy</dt>
                <dd className="dr-num">{spend.slotsLeft}</dd>
              </div>
              {spend.minimumHold > 0 && (
                <div>
                  <dt>Must hold</dt>
                  <dd className="dr-num">{money(spend.minimumHold)}</dd>
                </div>
              )}
            </dl>
            <p className="dr-footnote">
              {!spend.legal
                ? 'Over what the rules let you spend.'
                : spend.affordable
                  ? `The best player left that the change could still buy is ${getIdentity(spend.affordable.id)?.name ?? spend.affordable.name} (${spend.affordable.position}, ${money(spend.affordable.estimatedValue)}).`
                  : 'Nothing left on the board would fit in the change.'}
            </p>
          </Section>
        )}

        {/* ---- what the web said ----------------------------------------- */}
        {mine && (
          <Section
            title="What the web said"
            aside={mine.direction === 'PAY_UP' ? 'pay up' : 'fade'}
          >
            <p className="dr-tonight-line dr-tonight-research" data-direction={mine.direction}>
              {mine.headline}
            </p>
            <p className="dr-footnote">
              {mine.findings} sourced finding{mine.findings === 1 ? '' : 's'} — the Research tab has
              the links and the dates.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
};
