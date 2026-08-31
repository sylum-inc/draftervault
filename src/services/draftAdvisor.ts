/**
 * The opinion layer.
 *
 * Everything else in this app reports: a number on a card traces to an
 * observation, and a chart is a picture of one. This file does the other thing —
 * it takes a position. That is why it is a separate module rather than more
 * fields on `DraftAnalytics`: advice has a different epistemic status from a
 * target share, it is switched off by default, and it is rendered in its own
 * visual register so nobody mistakes a call for a measurement.
 *
 * Every call carries the reason that produced it. An unexplained recommendation
 * is worse than none, because it cannot be argued with.
 */
import { POSITIONS, unfilledSlotsFor } from '@/lib/valuation';
import type { AuctionDraftService, DraftAnalytics, Player, Team } from './auctionDraftService';

export type Verdict = 'BID' | 'VALUE' | 'HOLD' | 'PASS' | 'TAKE';

export interface Advice {
  verdict: Verdict;
  headline: string;
  /** Why, in the order that decided it. Always at least one. */
  reasons: string[];
  /**
   * The number the advisor would stop at, which is not always the max bid.
   *
   * Null in the snake half, where the pick is free. A stop price of $0 beside a
   * free pick reads as a recommendation to spend nothing on him, which is a
   * different claim from there being no price to stop at.
   */
  stopAt: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * What one opponent would plausibly go to, beside what the rules allow.
 *
 * The two numbers are deliberately carried together and named differently,
 * because confusing them is expensive in both directions. `legal` is a fact
 * from the engine — `spendableFor`, the same call that decides whether a bid is
 * accepted — and after the reserve change it is essentially a team's whole
 * remaining budget, which is higher than anybody at the table expects.
 * `plausible` is this file's guess at what a manager with those roster holes
 * and that money would actually say out loud, and it is a guess.
 */
export interface RivalRead {
  team: Team;
  /** The rules' ceiling, carried through from the engine unchanged. */
  legal: number;
  /** What this roster would plausibly go to. An estimate, never a rule. */
  plausible: number;
  /** Why the estimate sits where it does. */
  why: string;
  /** Starting slots this player would fill for them. */
  need: number;
}

/** Who is left in the bidding, as opinions about facts the engine supplied. */
export interface RoomRead {
  currentBid: number;
  /** Opponents worth watching, most dangerous first. */
  rivals: RivalRead[];
  /** Opponents who could legally beat the bid but have no reason to. */
  quiet: number;
  /** Opponents with no room for him at all. */
  blocked: number;
  /** Opponents whose money cannot reach the bid on the table. */
  outspent: number;
  /** The highest plausible number in the room: where the bidding should end. */
  topPlausible: number;
  /** The owner's own legal ceiling, when a team has been marked as theirs. */
  myCeiling: number | null;
}

/**
 * Who can actually outbid you on the player on the block.
 *
 * The fact half of this — who is legally able to beat the bid, and by how much
 * — is `service.getBidCompetition`, and every dollar of it comes from
 * `spendableFor`. Nothing here recomputes a legal ceiling; a number shown
 * beside the bid box that the engine would reject is exactly the bug both
 * halves exist to prevent.
 *
 * What this adds is the part the rules cannot say: whether they *would*. A team
 * holding $180 with its receivers filled is not a threat for a receiver, and
 * reading its $180 as danger is how a player is lost to a bidder who was never
 * in the room. The estimate is the top of the range that roster could justify —
 * the engine's own per-team analytics, which price the player at this room's
 * inflation, this team's holes and this position's scarcity — capped by what
 * the rules permit, because an estimate above the legal ceiling is a
 * recommendation to fear something that cannot happen.
 *
 * Ranked by the estimate rather than by money, and cut to the few that matter.
 * Twelve rows of budget is the board a bidder already has.
 */
export const readTheRoom = (
  player: Player,
  service: AuctionDraftService,
  currentBid: number,
  limit = 4
): RoomRead | null => {
  // Nobody outbids anybody in the snake: the pick is free and the order decides
  // who makes it. A ceiling in a phase with no bidding is a number about a
  // thing that is not happening.
  if (service.getPhase() === 'snake') return null;

  const competition = service.getBidCompetition(player.id, currentBid);
  if (!competition) return null;

  const scarcity = service
    .getMarketState()
    .scarcity.find((row) => row.position === player.position);
  const thin = scarcity != null && scarcity.total > 0 && scarcity.gone / scarcity.total >= 0.6;

  const reads: RivalRead[] = competition.rivals.map((rival) => {
    let plausible = rival.ceiling;
    try {
      // The engine's own read of what this player is worth to *that* roster:
      // list price moved by the room's inflation, that team's unfilled starting
      // slots and how much of the position is gone. Reusing it rather than
      // writing a second pricing model here is the point — a rival's ceiling
      // and our own max bid must come out of the same arithmetic or the panel
      // is comparing two different opinions and calling one of them theirs.
      plausible = Math.min(
        rival.ceiling,
        service.getPlayerAnalytics(player.id, rival.team.id).maxBid
      );
    } catch {
      /* an unknown team cannot be priced; the legal ceiling stands */
    }

    const gap = rival.ceiling - plausible;
    const why =
      rival.need > 0
        ? thin
          ? `${rival.need} starting ${player.position} slot${rival.need === 1 ? '' : 's'} open and the position is thinning — they should chase this one.`
          : `${rival.need} starting ${player.position} slot${rival.need === 1 ? '' : 's'} still open, with $${rival.ceiling} to spend.`
        : gap > 0
          ? `Already carries ${rival.have} at ${player.position}, so the $${rival.ceiling} they are allowed is not money they need to spend here.`
          : `No ${player.position} slot left to fill — anything they bid is depth.`;

    return { team: rival.team, legal: rival.ceiling, plausible, why, need: rival.need };
  });

  reads.sort((a, b) => b.plausible - a.plausible || b.legal - a.legal);

  // A bid has to be beaten. An opponent whose estimate does not reach the
  // number on the table is not silent because he is poor — he is silent
  // because he does not want the player at that price, which is the whole
  // distinction this panel exists to draw.
  const toBeat = Math.max(1, competition.currentBid + (competition.currentBid > 0 ? 1 : 0));
  const live = reads.filter((read) => read.plausible >= toBeat);

  return {
    currentBid: competition.currentBid,
    rivals: live.slice(0, limit),
    quiet: reads.length - live.length,
    blocked: competition.blocked,
    outspent: competition.outspent,
    topPlausible: live[0]?.plausible ?? 0,
    myCeiling: competition.mine?.ceiling ?? null,
  };
};

/**
 * Bid, take the value, hold or walk.
 *
 * The verdict is a function of three things a bidder cannot hold in their head
 * at once: what the player is worth to *this* roster, what the room has been
 * paying, and what happens to the rest of the roster if the money goes here.
 */
export const adviseOnBid = (
  player: Player,
  team: Team | undefined,
  analytics: DraftAnalytics | null,
  service: AuctionDraftService,
  currentBid: number
): Advice | null => {
  if (!analytics || !team) return null;
  // Nothing here means anything once the money is finished: every number it
  // reasons from — the max bid, the room's premium, what the spend leaves per
  // slot — is a statement about a price, and a snake pick has none. Silence is
  // the honest answer; `adviseOnSnakePick` is the one that has something to say.
  if (service.getPhase() === 'snake') return null;

  const reasons: string[] = [];
  const market = service.getMarketState();
  const scarcity = market.scarcity.find((row) => row.position === player.position);
  const need = unfilledSlotsFor(player.position, team.roster, service.getLeagueShape());
  const simulation = service.simulateSpend(team.id, currentBid || analytics.targetBid);

  // 1. Does this roster still need the position at all?
  if (need > 0) {
    reasons.push(
      `${team.name} still needs ${need} starting ${player.position}${need === 1 ? '' : 's'}.`
    );
  } else {
    reasons.push(`${team.name}'s starting ${player.position} slots are already filled.`);
  }

  // 2. Is the position about to run out from under us?
  if (scarcity && scarcity.tierOneLeft > 0 && scarcity.tierOneLeft <= 3 && need > 0) {
    reasons.push(
      `Only ${scarcity.tierOneLeft} tier-one ${player.position}${scarcity.tierOneLeft === 1 ? '' : 's'} left on the board.`
    );
  }
  if (scarcity && scarcity.cliff >= 25 && need > 0) {
    reasons.push(
      `Waiting costs about ${scarcity.cliff} points — that is the drop from the best ${player.position} left to the fifth.`
    );
  }

  // 3. What is the room actually paying?
  if (market.premium != null && Math.abs(market.premium - 1) > 0.08) {
    reasons.push(
      market.premium > 1
        ? `The room is paying ${Math.round((market.premium - 1) * 100)}% over list, so this will cost more than the tag says.`
        : `The room is paying ${Math.round((1 - market.premium) * 100)}% under list — there is money still sitting unspent.`
    );
  }

  // 4. Does the market disagree with our board?
  const edge = player.market?.edge ?? null;
  if (edge != null && Math.abs(edge) >= 12) {
    reasons.push(
      edge > 0
        ? `Consensus has him ${edge} spots below our board, so the bidding should stay quiet.`
        : `Consensus has him ${Math.abs(edge)} spots above our board — expect company.`
    );
  }

  // 5. What does the spend do to the rest of the roster?
  if (simulation && simulation.slotsLeft > 0 && simulation.perSlot < 2 && currentBid > 0) {
    reasons.push(
      `At $${currentBid} there would be about $${Math.max(0, Math.round(simulation.perSlot))} a slot for ${simulation.slotsLeft} more players.`
    );
  }

  const bid = currentBid || analytics.openingBid;
  const target = analytics.targetBid;
  const max = analytics.maxBid;

  let verdict: Verdict;
  let headline: string;
  if (!simulation?.legal || bid > max) {
    verdict = 'PASS';
    headline = `Past the walk-away at $${max}.`;
  } else if (bid <= Math.round(target * 0.8) && need > 0) {
    verdict = 'VALUE';
    headline = `Under the target — this is the good end of the range.`;
  } else if (bid <= target) {
    verdict = 'BID';
    headline = need > 0 ? `Inside the target for a slot you need.` : `Fair, but not a need.`;
  } else {
    verdict = 'HOLD';
    headline = `Above target — only worth it if the position is about to empty.`;
  }

  // A verdict built on a projection with no tape behind it is a guess wearing a
  // number, and it says so.
  const confidence =
    player.recentTrends === 'STABLE' && (player.lastSeasonGames ?? 0) >= 12
      ? 'HIGH'
      : (player.lastSeasonGames ?? 0) >= 8
        ? 'MEDIUM'
        : 'LOW';

  return {
    verdict,
    headline,
    reasons,
    stopAt: verdict === 'PASS' ? max : Math.min(max, target),
    confidence,
  };
};

/**
 * Take him, wait, or he is not yours to take.
 *
 * The snake asks a different question from the auction, and the difference is
 * the whole of this function. Money decides nothing: every pick costs the same
 * nothing, so what a pick actually spends is the *slot* and the wait until the
 * turn comes round again. A back you take at the end of round two is a receiver
 * you do not get, and twenty-two picks will happen before you are asked again.
 *
 * Need is read through `unfilledSlotsFor` rather than the STARTERS table above,
 * which says WR:2 where this league fields three — and, more to the point, is a
 * second copy of a fact the league already states. A flex slot counts as a hole
 * for every position that could fill it, which is what that helper is for.
 */
export const adviseOnSnakePick = (
  player: Player,
  team: Team | undefined,
  players: Player[],
  service: AuctionDraftService
): Advice | null => {
  if (!team) return null;
  if (service.getPhase() !== 'snake') return null;

  const league = service.getLeagueShape();
  const reasons: string[] = [];
  const legal = service.validateSnakePick(player.id, team.id);
  const available = players.filter((p) => !p.isDrafted);
  const byPoints = (a: Player, b: Player) => b.projectedPoints - a.projectedPoints;

  const need = unfilledSlotsFor(player.position, team.roster, league);
  const bestAtHis = available
    .filter((p) => p.position === player.position)
    .sort(byPoints)
    .find(() => true);
  const bestAtNeed = available
    .filter((p) => unfilledSlotsFor(p.position, team.roster, league) > 0)
    .sort(byPoints)
    .find(() => true);
  const bestLeft = [...available].sort(byPoints)[0];

  // How long the roster waits before it is asked again. At the turn it is one
  // pick; in the middle of a round it is most of two.
  const upcoming = service.getSnakeUpcoming(league.teams * 2 + 1);
  const nextTurn = upcoming.findIndex((slot, index) => index > 0 && slot.team.id === team.id);

  if (need > 0) {
    reasons.push(
      `${team.name} still has ${need} starting ${player.position}${need === 1 ? '' : 's'} to fill.`
    );
  } else {
    reasons.push(
      `${team.name}'s starting ${player.position} slots are full — this is bench depth.`
    );
  }

  if (nextTurn > 0) {
    reasons.push(
      `${nextTurn} pick${nextTurn === 1 ? '' : 's'} before ${team.name} is on the clock again.`
    );
  }

  if (bestAtHis && bestAtHis.id !== player.id) {
    reasons.push(
      `${bestAtHis.name} is the highest-projected ${player.position} left, ${Math.round(bestAtHis.projectedPoints - player.projectedPoints)} points ahead of him.`
    );
  }

  if (bestAtNeed && bestAtNeed.id !== player.id && need === 0) {
    reasons.push(
      `${bestAtNeed.name} is still there at ${bestAtNeed.position}, which this roster does have to fill.`
    );
  }

  const scarcity = service
    .getMarketState()
    .scarcity.find((row) => row.position === player.position);
  if (scarcity && scarcity.cliff >= 25 && need > 0) {
    reasons.push(
      `Waiting costs about ${scarcity.cliff} points at ${player.position} — the drop from the best left to the fifth.`
    );
  }

  let verdict: Verdict;
  let headline: string;
  if (!legal.ok) {
    verdict = 'PASS';
    headline = legal.message;
    reasons.unshift(legal.message);
  } else if (
    bestAtHis &&
    bestAtHis.id !== player.id &&
    bestAtHis.projectedPoints > player.projectedPoints + 5
  ) {
    verdict = 'HOLD';
    headline = `There is a better ${player.position} on the board.`;
  } else if (need > 0) {
    verdict = 'TAKE';
    headline = `Fills a starting slot, and he is the best ${player.position} left.`;
  } else if (bestAtNeed && bestAtNeed.projectedPoints >= player.projectedPoints - 10) {
    verdict = 'HOLD';
    headline = `A slot still open has somebody comparable in it.`;
  } else if (bestLeft && bestLeft.id === player.id) {
    verdict = 'TAKE';
    headline = `Best player left on the board.`;
  } else {
    verdict = 'HOLD';
    headline = `Fine, but neither a need nor the best left.`;
  }

  const confidence =
    player.recentTrends === 'STABLE' && (player.lastSeasonGames ?? 0) >= 12
      ? 'HIGH'
      : (player.lastSeasonGames ?? 0) >= 8
        ? 'MEDIUM'
        : 'LOW';

  // No stop price: the pick is free, and $0 would read as advice about a price.
  return { verdict, headline, reasons, stopAt: null, confidence };
};

/** Why a name is being put up. The four reasons an auction actually has. */
export type NominationKind = 'drain' | 'stopper' | 'scarcity' | 'value';

export interface NominationCall {
  player: Player;
  kind: NominationKind;
  reason: string;
}

/** What to call, what to sit on, and the read of the room that decided it. */
export interface NominationPlan {
  /** Best first, three at most — a list nobody can read at speed is not used. */
  calls: NominationCall[];
  /** Players to keep off the block for now, and what putting one up would cost. */
  protect: Array<{ player: Player; reason: string }>;
  /** The state of the room the order was chosen against. */
  headline: string;
}

/**
 * What to put on the block when it is your turn.
 *
 * The counter-intuitive part of an auction, and the one thing a first-timer
 * always gets wrong: early on you nominate players you do *not* want, to drain
 * everyone else's budget while yours is intact, and you keep the players you do
 * want off the block for exactly as long as the room can still afford them.
 *
 * The part that is easy to state and hard to notice is when that flips. Draining
 * only works while there is money to drain; once the room is spent, the same
 * player you were protecting is a player nobody can bid on, and putting him up
 * is how you buy him for a fraction of his price. So the room's unspent money —
 * a fact, off the engine — decides the order the calls come in, and a target
 * nobody can outbid stops being protected and becomes the first name to call.
 *
 * Extended rather than replaced: the early-drain spine and its wording are the
 * original function's, because that half was right. What it did not do was
 * carry more than one suggestion, protect anything, or notice the flip.
 */
export const adviseOnNomination = (
  players: Player[],
  team: Team | undefined,
  service: AuctionDraftService,
  options: { watchlist?: readonly string[] } = {}
): NominationPlan | null => {
  if (!team) return null;
  // Nobody nominates in a snake draft — the order does it for you — and a
  // suggestion about which player to put up is advice about a thing that is no
  // longer happening.
  if (service.getPhase() === 'snake') return null;

  const league = service.getLeagueShape();
  // Whom the money is actually chasing, read off the engine rather than
  // rebuilt from `estimatedValue > 1`. That proxy is wrong the moment an
  // imported ranking prices a snake-only player above a dollar, and this file
  // would then be advising the room to auction somebody nobody is auctioning.
  const available = service.getForSale().filter((p) => !p.isDrafted);
  if (!available.length) return null;

  const basis = service.getInflationBasis();
  const adjust = service.getPriceAdjuster();
  const market = service.getMarketState();
  const budgetTotal = league.teams * league.budget;
  // How much of the auction's money is still in the room. This is what decides
  // whether draining is worth doing at all: it is the resource being drained.
  const unspent = budgetTotal > 0 ? basis.moneyLeft / budgetTotal : 0;

  const need = (player: Player) => unfilledSlotsFor(player.position, team.roster, league);
  const dearest = (list: Player[]) => [...list].sort((a, b) => b.estimatedValue - a.estimatedValue);

  // Players this roster wants: the owner's own watchlist where there is one,
  // and otherwise the best of what would fill a starting slot. A stated list
  // beats an inferred one — the watchlist is the owner saying so.
  const watchlist = options.watchlist ?? [];
  const wanted = watchlist.length
    ? available.filter((p) => watchlist.includes(p.id))
    : dearest(available.filter((p) => need(p) > 0)).slice(0, 6);

  const calls: NominationCall[] = [];
  const protect: NominationPlan['protect'] = [];
  const seen = new Set<string>();
  const held = new Set<string>();

  /*
   * One place enforces the invariant, because remembering it at four call sites
   * is how it got broken. A list that protects a player two lines above where
   * it nominates him is a list nobody will trust again, and the scarcity call
   * did exactly that: it took the dearest player at the thinnest position with
   * no exclusion, and the thinnest position is precisely where a watched player
   * tends to be.
   */
  const add = (call: NominationCall | null) => {
    if (!call || seen.has(call.player.id) || held.has(call.player.id)) return;
    if (calls.length >= 3) return;
    seen.add(call.player.id);
    calls.push(call);
  };
  const hold = (row: NominationPlan['protect'][number] | null) => {
    if (!row || held.has(row.player.id) || seen.has(row.player.id)) return;
    held.add(row.player.id);
    protect.push(row);
  };

  /*
   * The flip.
   *
   * A player we want whom nobody left can outbid is not a player to protect —
   * he is the next name to call, at a dollar over whatever the room can still
   * muster. The competition is the engine's, priced at tonight's number rather
   * than the list, because that is what he will actually cost.
   */
  for (const player of dearest(wanted)) {
    const price = adjust.price(player);
    const competition = service.getBidCompetition(player.id, price - 1);
    if (!competition) continue;
    // The engine separates out the team the owner marked as theirs, and this
    // function is asked to speak for a team — usually the same one, but nothing
    // guarantees it. Counting the roster we are advising as a rival to itself
    // would report that somebody can outbid us when the somebody is us.
    const rivals = competition.rivals.filter((rival) => rival.team.id !== team.id);
    if (rivals.length === 0) {
      add({
        player,
        kind: 'stopper',
        reason: `Nobody left can put $${price} on ${player.name} — call him now and he is yours at the bottom of the room.`,
      });
    } else if (protect.length < 3) {
      hold({
        player,
        reason: `${rivals.length} team${rivals.length === 1 ? '' : 's'} can still find $${price} for him. Putting him up now is bidding against a full room.`,
      });
    }
  }

  // A position this roster needs that is emptying out. Waiting for the price to
  // come down stops being clever when there is nobody left to buy.
  const thin = market.scarcity
    .filter((row) => unfilledSlotsFor(row.position, team.roster, league) > 0)
    // Movement, not merely a short shelf: quarterback ships with exactly one
    // tier-one player, so "two or fewer left" is true of it before anybody has
    // drafted at all, and a position nobody has taken from is not emptying.
    .filter((row) => row.gone > 0)
    .filter((row) => row.tierOneLeft <= 2 || (row.total > 0 && row.gone / row.total >= 0.6))
    .sort((a, b) => b.cliff - a.cliff)[0];
  if (thin) {
    const target = dearest(available.filter((p) => p.position === thin.position))[0];
    if (target) {
      add({
        player: target,
        kind: 'scarcity',
        reason: `${thin.position} is the thinnest slot left on this roster — ${thin.tierOneLeft} tier-one left and ${thin.total - thin.gone} startable. Put one up while there is still a choice.`,
      });
    }
  }

  /*
   * Expensive, and at a position this roster is not chasing.
   *
   * Only worth doing while there is money in the room to move; against an empty
   * room it is a gift to whoever still has a dollar.
   *
   * The fallback is not a technicality. At the first nomination of the night
   * every position has an unfilled starting slot, so there is no player this
   * roster does not need and the "does not need him" filter matches nobody —
   * which is exactly the moment draining matters most. So the dearest player we
   * are not protecting is nominated anyway, and the reason says why it is still
   * the right call rather than claiming a need we do not have.
   */
  if (unspent >= 0.35) {
    const held = new Set([...protect.map((row) => row.player.id), ...watchlist]);
    const spare = available.filter((p) => !held.has(p.id));
    const pick = dearest(spare.filter((p) => need(p) === 0))[0] ?? dearest(spare)[0];
    if (pick) {
      add({
        player: pick,
        kind: 'drain',
        reason:
          need(pick) === 0
            ? `Nominate the money away: ${pick.name} costs about $${adjust.price(pick)} and ${team.name} does not need him.`
            : `Nominate the money away: ${pick.name} costs about $${adjust.price(pick)} and somebody will pay it. This early every roster needs everything, so the money is what you are draining, not the position.`,
      });
    }
  }

  // Whatever is left worth the most, skipping anything this same plan has just
  // said to keep off the block — a list that protects a player two lines above
  // where it nominates him is a list nobody will trust again. Never nothing: it
  // is somebody's turn and a name has to be called.
  const open = available.filter((p) => !held.has(p.id));
  const best = dearest(open.length ? open : available)[0];
  if (best) {
    add({
      player: best,
      kind: 'value',
      reason: `Best player still for sale, at about $${adjust.price(best)}.`,
    });
  }

  const headline =
    unspent >= 0.6
      ? `The room still holds $${basis.moneyLeft} of $${budgetTotal} — drain it before you spend yours.`
      : unspent >= 0.35
        ? `$${basis.moneyLeft} left in the room. Still worth draining, but the window is closing.`
        : `Only $${basis.moneyLeft} left in the room — the players you want are cheap now, so call them.`;

  return { calls, protect, headline };
};

export interface Alert {
  /**
   * Stable across renders, and unique to the thing being warned about.
   *
   * These used to be keyed on the message text, which collides the moment two
   * read alike — "One tier-one RB left." and the same sentence about receivers
   * differ, but a run alert and a tier alert at one position quite easily do
   * not, and React then drops one of them silently. The id names the subject:
   * kind, position, and where relevant the tier.
   */
  id: string;
  kind: 'tier-cliff' | 'tier-break' | 'position-run' | 'price-run' | 'budget' | 'roster-need';
  severity: 'info' | 'warning';
  message: string;
}

/** Things worth interrupting for, in the order they should be read. */
export const buildAlerts = (
  players: Player[],
  team: Team | undefined,
  service: AuctionDraftService
): Alert[] => {
  const alerts: Alert[] = [];
  const market = service.getMarketState();
  // Money says nothing once the auction is over. The two advice entry points
  // beside this one already return null in the snake; this rail was the one
  // that went on warning about budgets through a phase in which every
  // remaining slot is free — telling a team holding $1 that it is in trouble
  // when it is not, which is the opposite of the truth. Supply-shaped alerts
  // stay: a tier really does empty in the snake.
  const auction = service.getPhase() !== 'snake';
  const league = service.getLeagueShape();

  // Tier one is covered by the general tier-break rule below, which names the
  // player and quotes the step down. Firing both put two warning rows with the
  // same subject into the rail at the moment the room is busiest, and the
  // vaguer of the two said strictly less.
  const named = new Set(
    service
      .getTierBreaks()
      .filter((row) => row.tier === 1 && row.left === 1 && row.last)
      .map((row) => row.position)
  );

  for (const row of market.scarcity) {
    if (row.tierOneLeft === 1 && row.sold >= 2 && !named.has(row.position)) {
      alerts.push({
        id: `tier-cliff:${row.position}`,
        kind: 'tier-cliff',
        severity: 'warning',
        message: `One tier-one ${row.position} left.`,
      });
    }
    if (auction && row.premium != null && row.premium >= 1.25 && row.sold >= 3) {
      alerts.push({
        id: `price-run:${row.position}`,
        kind: 'price-run',
        severity: 'warning',
        message: `${row.position} is running hot — the room has paid ${Math.round((row.premium - 1) * 100)}% over list on ${row.sold} of them.`,
      });
    }
  }

  /*
   * The shelf about to empty.
   *
   * Distinct from the tier-one warning above, which only ever fires at the top
   * of a position: a run through tier two is the same event and costs the same
   * money, and by the time tier one is the concern the decision has usually
   * been made. The step down is quoted because that is the whole reason to
   * care — a tier with a $1 gap under it is not urgent at any count.
   *
   * Counts both halves of the draft. A tier is emptied by a snake pick exactly
   * as it is by a $40 one; the dollars in the step are list prices of players
   * still on the board, not money anybody spent, so quoting them here breaks no
   * rule about what the snake may be counted in.
   */
  for (const row of service.getTierBreaks()) {
    if (row.left !== 1 || row.started < 2 || !row.last) continue;
    const step =
      row.dollarStep != null && row.dollarStep > 0
        ? `${row.pointStep} points and $${row.dollarStep} below him`
        : `${row.pointStep} points below him`;
    alerts.push({
      id: `tier-break:${row.position}:${row.tier}`,
      kind: 'tier-break',
      severity: 'warning',
      message: `${row.last.name} is the last tier-${row.tier} ${row.position}. The next one down is ${step}.`,
    });
  }

  /*
   * A position leaving the board faster than the board is.
   *
   * Supply again, so a snake pick counts: the reason to care about a run is
   * that waiting stopped being an option, and it stops being an option however
   * the player left. Half a window is the threshold because with six positions
   * an even draw is about a sixth — three of the last ten at one position is
   * not noise.
   */
  for (const row of service.getPositionRuns()) {
    if (row.window < 6 || row.taken < 3 || row.share < 0.4 || row.left === 0) continue;
    const short = team ? unfilledSlotsFor(row.position, team.roster, league) : 0;
    alerts.push({
      id: `position-run:${row.position}`,
      kind: 'position-run',
      severity: short > 0 ? 'warning' : 'info',
      message: `${row.position} run: ${row.taken} of the last ${row.window} picks, ${row.left} above replacement left${short > 0 ? ` and ${team!.name} still needs ${short}` : ''}.`,
    });
  }

  if (team) {
    const filled = Object.values(team.roster).reduce((a, b) => a + b, 0);
    // Read off the league's own lineup rather than the module's table, which
    // says WR:2 where this league starts three. That table is the last second
    // definition of a starting lineup left in the file.
    const startersLeft = POSITIONS.reduce(
      (total, position) => total + unfilledSlotsFor(position, team.roster, league),
      0
    );
    if (auction && startersLeft > 0 && team.remaining <= startersLeft * 3 && filled > 4) {
      alerts.push({
        id: `budget:${team.id}`,
        kind: 'budget',
        severity: 'warning',
        message: `${team.name} has $${team.remaining} left and ${startersLeft} starting slot${startersLeft === 1 ? '' : 's'} still open.`,
      });
    }
    /*
     * A seat this roster still needs, at a position running out of anybody
     * worth putting in it.
     *
     * Counted above replacement rather than by tier, which is the definition
     * the run alert twenty lines up already uses — two answers to "how many
     * startable ones are left" in one function, and the tier one was wrong.
     * Kickers and defences are regressed so hard that the pool holds none
     * above tier 2 at all, so this fired "0 startable Ks left and Team 1 needs
     * 1" from the fourth pick of every draft and never stopped. It is not even
     * true in the sense that matters: no kicker is on the sheet, so the snake
     * hands you one for nothing.
     */
    const startableLeft = new Map(service.getPositionRuns().map((row) => [row.position, row.left]));
    for (const position of POSITIONS) {
      const short = unfilledSlotsFor(position, team.roster, league);
      const left = startableLeft.get(position) ?? 0;
      if (short > 0 && left <= 4 && filled > 3) {
        alerts.push({
          id: `roster-need:${position}`,
          kind: 'roster-need',
          severity: 'info',
          message: `${left} startable ${position}${left === 1 ? '' : 's'} left and ${team.name} needs ${short}.`,
        });
      }
    }
  }

  return alerts.slice(0, 5);
};
