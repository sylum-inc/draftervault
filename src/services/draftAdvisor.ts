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
import type {
  AuctionDraftService,
  DraftAnalytics,
  Player,
  PlayerPosition,
  Team,
} from './auctionDraftService';

export type Verdict = 'BID' | 'VALUE' | 'HOLD' | 'PASS';

export interface Advice {
  verdict: Verdict;
  headline: string;
  /** Why, in the order that decided it. Always at least one. */
  reasons: string[];
  /** The number the advisor would stop at, which is not always the max bid. */
  stopAt: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Alert {
  kind: 'tier-cliff' | 'position-run' | 'budget' | 'roster-need';
  severity: 'info' | 'warning';
  message: string;
}

const STARTERS: Record<PlayerPosition, number> = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 };

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

  const reasons: string[] = [];
  const market = service.getMarketState();
  const scarcity = market.scarcity.find((row) => row.position === player.position);
  const need = Math.max(0, (STARTERS[player.position] ?? 0) - (team.roster[player.position] ?? 0));
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
 * What to put on the block when it is your turn.
 *
 * The counter-intuitive part of an auction, and the one thing a first-timer
 * always gets wrong: early on you nominate players you do *not* want, to drain
 * everyone else's budget while yours is intact.
 */
export const adviseOnNomination = (
  players: Player[],
  team: Team | undefined,
  service: AuctionDraftService
): { player: Player; reason: string } | null => {
  if (!team) return null;
  const available = players.filter((p) => !p.isDrafted && p.estimatedValue > 1);
  if (!available.length) return null;

  const filled = Object.values(team.roster).reduce((a, b) => a + b, 0);
  const early = filled <= 2;

  if (early) {
    // Expensive, and at a position this roster is not chasing.
    const drains = available
      .filter((p) => (team.roster[p.position] ?? 0) >= (STARTERS[p.position] ?? 0))
      .sort((a, b) => b.estimatedValue - a.estimatedValue);
    const pick = drains[0] ?? available.sort((a, b) => b.estimatedValue - a.estimatedValue)[0];
    return {
      player: pick,
      reason: `Nominate the money away: ${pick.name} costs about $${pick.estimatedValue} and ${team.name} does not need him.`,
    };
  }

  const market = service.getMarketState();
  const thin = market.scarcity
    .filter((row) => (STARTERS[row.position] ?? 0) > (team.roster[row.position] ?? 0))
    .sort((a, b) => b.cliff - a.cliff)[0];
  const target = available
    .filter((p) => !thin || p.position === thin.position)
    .sort((a, b) => b.estimatedValue - a.estimatedValue)[0];
  if (!target) return null;
  return {
    player: target,
    reason: thin
      ? `${thin.position} is the thinnest slot left on this roster — put one up while there is still a choice.`
      : `Best player left on the board.`,
  };
};

/** Things worth interrupting for, in the order they should be read. */
export const buildAlerts = (
  players: Player[],
  team: Team | undefined,
  service: AuctionDraftService
): Alert[] => {
  const alerts: Alert[] = [];
  const market = service.getMarketState();

  for (const row of market.scarcity) {
    if (row.tierOneLeft === 1 && row.sold >= 2) {
      alerts.push({
        kind: 'tier-cliff',
        severity: 'warning',
        message: `One tier-one ${row.position} left.`,
      });
    }
    if (row.premium != null && row.premium >= 1.25 && row.sold >= 3) {
      alerts.push({
        kind: 'position-run',
        severity: 'warning',
        message: `${row.position} is running hot — the room has paid ${Math.round((row.premium - 1) * 100)}% over list on ${row.sold} of them.`,
      });
    }
  }

  if (team) {
    const filled = Object.values(team.roster).reduce((a, b) => a + b, 0);
    const startersLeft = (Object.keys(STARTERS) as PlayerPosition[]).reduce(
      (total, position) => total + Math.max(0, STARTERS[position] - (team.roster[position] ?? 0)),
      0
    );
    if (startersLeft > 0 && team.remaining <= startersLeft * 3 && filled > 4) {
      alerts.push({
        kind: 'budget',
        severity: 'warning',
        message: `${team.name} has $${team.remaining} left and ${startersLeft} starting slot${startersLeft === 1 ? '' : 's'} still open.`,
      });
    }
    for (const position of Object.keys(STARTERS) as PlayerPosition[]) {
      const short = STARTERS[position] - (team.roster[position] ?? 0);
      const left = players.filter(
        (p) => p.position === position && !p.isDrafted && p.tier <= 2
      ).length;
      if (short > 0 && left <= 4 && filled > 3) {
        alerts.push({
          kind: 'roster-need',
          severity: 'info',
          message: `${left} startable ${position}${left === 1 ? '' : 's'} left and ${team.name} needs ${short}.`,
        });
      }
    }
  }

  return alerts.slice(0, 5);
};
