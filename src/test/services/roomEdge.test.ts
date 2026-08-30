import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService, INFLATION_BOUNDS } from '@/services/auctionDraftService';
import { adviseOnNomination, buildAlerts, readTheRoom } from '@/services/draftAdvisor';
import { inflatedPrice, leagueShape } from '@/lib/valuation';

/**
 * The four things this app is for on the night: who can still take a player off
 * you, what he actually costs at this room's prices, what to put up when it is
 * your turn, and what is about to run out.
 *
 * Two of the four are half fact and half opinion, and most of what is asserted
 * below is that the halves stay on their own side of the line. The legal
 * ceiling is the sharpest case: a number shown beside the bid box that the
 * engine would then reject is worse than showing nothing at all, so it is
 * tested against `validateBid` itself rather than against a copy of the
 * arithmetic.
 */

/** A sheet short enough that an auction can be finished inside a test. */
const smallSheet = (service: AuctionDraftService, count: number): string[] =>
  [...service.getPlayers()]
    .filter((player) => player.valueOverReplacement > 0)
    .sort((a, b) => b.modelValue - a.modelValue)
    .slice(0, count)
    .map((player) => player.id);

const finishAuction = (service: AuctionDraftService): void => {
  for (const player of service.getSheetRemaining()) service.removeFromSheet(player.id);
};

describe('who can actually outbid you', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
  });

  it('reports a ceiling the engine will actually accept, and one dollar more that it will not', () => {
    const player = service.getAvailablePlayers()[0];
    const competition = service.getBidCompetition(player.id, 0)!;

    expect(competition.rivals.length).toBeGreaterThan(0);
    for (const rival of competition.rivals) {
      // This is the whole point of routing through spendableFor rather than
      // recomputing: the number beside the bid box has to be the number the
      // rules use, to the dollar, in both directions.
      expect(service.validateBid(player.id, rival.team.id, rival.ceiling).ok).toBe(true);
      const over = service.validateBid(player.id, rival.team.id, rival.ceiling + 1);
      expect(over.ok).toBe(false);
      expect(over.ok === false && over.code).toBe('insufficient-funds');
    }
  });

  it('holds nothing back in a partial auction, because the snake fills the rest for free', () => {
    const player = service.getAvailablePlayers()[0];
    const [rival] = service.getBidCompetition(player.id, 0)!.rivals;

    // The reserve is the thing that used to make the room read as poorer than
    // it is — an opponent looking tapped out at $88 while they could go to $96.
    expect(rival.held).toBe(0);
    expect(rival.ceiling).toBe(rival.team.remaining);
  });

  it('still holds a dollar a slot back when the auction buys the whole roster', () => {
    const whole = new AuctionDraftService(leagueShape({ auctionSheetSize: null }));
    const player = whole.getAvailablePlayers()[0];
    const [rival] = whole.getBidCompetition(player.id, 0)!.rivals;

    expect(rival.held).toBeGreaterThan(0);
    expect(rival.ceiling).toBe(rival.team.remaining - rival.held);
    expect(whole.validateBid(player.id, rival.team.id, rival.ceiling + 1).ok).toBe(false);
  });

  it('counts teams with no room for him rather than listing them at nothing', () => {
    const league = service.getLeagueShape();

    // Fill one team to its kicker limit. It is not a quiet bidder; it cannot
    // bid at any price, and a $200 ceiling beside its name would be a lie.
    const kickers = service.getAvailablePlayers().filter((p) => p.position === 'K');
    for (let i = 0; i < league.positionLimits.K; i++) {
      service.draftPlayer(kickers[i].id, 'team-2', 1);
    }

    const kicker = service.getAvailablePlayers().find((p) => p.position === 'K')!;
    const competition = service.getBidCompetition(kicker.id, 0)!;
    expect(competition.blocked).toBe(1);
    expect(competition.rivals.some((rival) => rival.team.id === 'team-2')).toBe(false);
  });

  it('separates the owner’s own ceiling from the opponents’', () => {
    service.setMyTeam('team-1');
    const player = service.getAvailablePlayers()[0];
    const competition = service.getBidCompetition(player.id, 0)!;

    expect(competition.mine?.team.id).toBe('team-1');
    expect(competition.mine?.mine).toBe(true);
    expect(competition.rivals.some((rival) => rival.team.id === 'team-1')).toBe(false);
    expect(competition.rivals).toHaveLength(service.getTeams().length - 1);
  });

  it('drops teams whose money cannot reach the bid on the table', () => {
    const players = service.getAvailablePlayers();
    service.draftPlayer(players[0].id, 'team-2', 195);

    const competition = service.getBidCompetition(players[1].id, 20)!;
    expect(competition.rivals.some((rival) => rival.team.id === 'team-2')).toBe(false);
    expect(competition.outspent).toBe(1);
    // Everybody who is listed can genuinely beat the number.
    for (const rival of competition.rivals) expect(rival.ceiling).toBeGreaterThan(20);
  });

  it('keeps the estimate at or under what the rules allow', () => {
    service.setMyTeam('team-1');
    const player = service.getAvailablePlayers()[0];
    const read = readTheRoom(player, service, 0)!;

    expect(read.rivals.length).toBeGreaterThan(0);
    for (const rival of read.rivals) {
      // An estimate above the legal ceiling is advice to fear something that
      // cannot happen, which is how a player is walked away from for nothing.
      expect(rival.plausible).toBeLessThanOrEqual(rival.legal);
      expect(rival.why.length).toBeGreaterThan(0);
    }
    expect(read.rivals[0].plausible).toBe(read.topPlausible);
  });

  it('reads a roster with the position already full as no threat, whatever it holds', () => {
    const league = service.getLeagueShape();
    const tightEnds = service.getAvailablePlayers().filter((p) => p.position === 'TE');
    // team-3 buys its tight ends cheaply: still rich, and no longer interested.
    for (let i = 0; i < league.startingLineup.TE; i++) {
      service.draftPlayer(tightEnds[i].id, 'team-3', 1);
    }

    const target = service.getAvailablePlayers().find((p) => p.position === 'TE')!;
    const read = readTheRoom(target, service, 0)!;
    const filled = read.rivals.find((rival) => rival.team.id === 'team-3');

    // They are legally able to bid nearly everything they hold, and that fact
    // is still reported; what the estimate says is that they would not.
    const legal = service
      .getBidCompetition(target.id, 0)!
      .rivals.find((r) => r.team.id === 'team-3')!;
    expect(legal.ceiling).toBeGreaterThan(150);
    if (filled) expect(filled.plausible).toBeLessThan(filled.legal);
  });

  it('says nothing about outbidding once the money is finished', () => {
    service.setAuctionSheet(smallSheet(service, 20));
    finishAuction(service);
    expect(service.getPhase()).toBe('snake');

    const player = service.getAvailablePlayers()[0];
    expect(readTheRoom(player, service, 0)).toBeNull();
  });
});

describe('inflation-adjusted prices', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
  });

  it('explains the number with the same arithmetic that produced it', () => {
    const players = service.getAvailablePlayers();
    service.draftPlayer(players[0].id, 'team-1', 90);

    const basis = service.getInflationBasis();
    expect(basis.raw).toBeCloseTo(basis.moneyLeft / basis.valueLeft, 6);
    expect(basis.inflation).toBeCloseTo(
      Math.max(INFLATION_BOUNDS.min, Math.min(INFLATION_BOUNDS.max, basis.raw)),
      6
    );
    // One definition: the meter and the prices cannot describe different rooms.
    expect(basis.inflation).toBe(service.getMarketState().inflation);
    expect(basis.forSaleLeft).toBe(basis.forSaleTotal - 1);
  });

  it('restates a price at that multiplier and nowhere else', () => {
    service.draftPlayer(service.getAvailablePlayers()[0].id, 'team-1', 120);
    const adjust = service.getPriceAdjuster();
    const player = service.getAvailablePlayers().find((p) => p.onSheet && p.estimatedValue > 5)!;

    expect(adjust.price(player)).toBe(inflatedPrice(player.estimatedValue, adjust.inflation));
    expect(adjust.price(player)).not.toBe(player.estimatedValue);
  });

  it('leaves a player nobody is auctioning at his list price', () => {
    const sheet = smallSheet(service, 40);
    service.setAuctionSheet(sheet);
    service.draftPlayer(sheet[0], 'team-1', 150);

    const adjust = service.getPriceAdjuster();
    const offSheet = service.getAvailablePlayers().find((p) => !p.onSheet)!;
    // Inflating a snake player's dollar to two states that the money is chasing
    // him, which is the one thing the sheet says it is not doing.
    expect(adjust.price(offSheet)).toBe(offSheet.estimatedValue);
  });

  it('measures over the sheet rather than the whole pool', () => {
    service.setAuctionSheet(smallSheet(service, 40));
    const basis = service.getInflationBasis();

    expect(basis.forSaleTotal).toBeLessThanOrEqual(40);
    expect(basis.forSaleTotal).toBeLessThan(service.getPlayers().length);
  });

  it('freezes at 1.00 through the snake, and says that is why', () => {
    service.setAuctionSheet(smallSheet(service, 20));
    finishAuction(service);

    const basis = service.getInflationBasis();
    expect(basis.frozen).toBe(true);
    expect(basis.inflation).toBe(1);
    expect(basis.clamped).toBeNull();
    // A free pick must not restate anybody's price either.
    const adjust = service.getPriceAdjuster();
    const player = service.getAvailablePlayers()[0];
    expect(adjust.price(player)).toBe(player.estimatedValue);
  });

  it('falls when the room spends over the list and rises when it spends under', () => {
    const before = service.getInflationBasis().inflation;
    const players = service.getAvailablePlayers().filter((p) => p.onSheet && p.estimatedValue > 30);

    const dear = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    dear.draftPlayer(players[0].id, 'team-1', players[0].estimatedValue * 2);
    expect(dear.getInflationBasis().inflation).toBeLessThan(before);

    localStorage.clear();
    const cheap = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    cheap.draftPlayer(players[0].id, 'team-1', 1);
    expect(cheap.getInflationBasis().inflation).toBeGreaterThan(before);
  });
});

describe('what to nominate', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    service.setMyTeam('team-1');
  });

  const me = () => service.getTeams().find((team) => team.id === 'team-1')!;

  it('keeps a player you want off the block while the room can still pay for him', () => {
    const target = service.getAvailablePlayers().find((p) => p.onSheet && p.estimatedValue > 30)!;
    const plan = adviseOnNomination(service.getPlayers(), me(), service, {
      watchlist: [target.id],
    })!;

    expect(plan.protect.map((row) => row.player.id)).toContain(target.id);
    expect(plan.calls.map((call) => call.player.id)).not.toContain(target.id);
    expect(plan.protect[0].reason).toMatch(/can still find \$\d+/);
  });

  it('calls him the moment nobody left can outbid you for him', () => {
    const target = service.getAvailablePlayers().find((p) => p.onSheet && p.estimatedValue > 30)!;
    // Drain every opponent: each buys one player for all but a dollar of their
    // budget. This is the flip the whole strategy turns on — the player you
    // were protecting becomes the player nobody can bid against.
    const fodder = service.getAvailablePlayers().filter((p) => p.id !== target.id);
    service
      .getTeams()
      .filter((team) => team.id !== 'team-1')
      .forEach((team, index) => {
        service.draftPlayer(fodder[index].id, team.id, team.remaining - 1);
      });

    const plan = adviseOnNomination(service.getPlayers(), me(), service, {
      watchlist: [target.id],
    })!;

    expect(plan.calls[0].kind).toBe('stopper');
    expect(plan.calls[0].player.id).toBe(target.id);
    expect(plan.protect).toHaveLength(0);
    expect(plan.headline).toContain('cheap now');
  });

  it('never suggests a player who has already gone, and never repeats itself', () => {
    const players = service.getAvailablePlayers();
    for (let i = 0; i < 6; i++) service.draftPlayer(players[i].id, `team-${i + 2}`, 20);

    const plan = adviseOnNomination(service.getPlayers(), me(), service)!;
    expect(plan.calls.length).toBeGreaterThan(0);
    expect(plan.calls.length).toBeLessThanOrEqual(3);
    expect(new Set(plan.calls.map((call) => call.player.id)).size).toBe(plan.calls.length);
    for (const call of plan.calls) {
      expect(call.player.isDrafted).toBe(false);
      expect(call.reason.length).toBeGreaterThan(0);
    }
  });

  it('stops recommending a drain once there is nothing left to drain', () => {
    const fodder = service.getAvailablePlayers();
    service
      .getTeams()
      .filter((team) => team.id !== 'team-1')
      .forEach((team, index) => {
        service.draftPlayer(fodder[index].id, team.id, team.remaining - 1);
      });

    const plan = adviseOnNomination(service.getPlayers(), me(), service)!;
    expect(plan.calls.some((call) => call.kind === 'drain')).toBe(false);
  });

  it('never nominates a player it has just said to protect', () => {
    const plan = adviseOnNomination(service.getPlayers(), me(), service)!;
    const held = new Set(plan.protect.map((row) => row.player.id));
    for (const call of plan.calls) expect(held.has(call.player.id)).toBe(false);
  });

  it('only ever suggests players the money is actually buying', () => {
    service.setAuctionSheet(smallSheet(service, 40));
    const plan = adviseOnNomination(service.getPlayers(), me(), service)!;
    for (const call of plan.calls) expect(call.player.onSheet).toBe(true);
  });
});

describe('runs and tier breaks', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
  });

  const team = () => service.getTeams()[0];

  it('gives every alert an id that survives two of them reading alike', () => {
    const players = service.getAvailablePlayers();
    for (let i = 0; i < 12; i++) service.draftPlayer(players[i].id, `team-${(i % 12) + 1}`, 15);

    const alerts = buildAlerts(service.getPlayers(), team(), service);
    for (const alert of alerts) expect(alert.id).toMatch(/^[a-z-]+:/);
    expect(new Set(alerts.map((alert) => alert.id)).size).toBe(alerts.length);
  });

  it('warns on the last player of a tier, and says what the step down costs', () => {
    const league = service.getLeagueShape();
    const wideOuts = service
      .getAvailablePlayers()
      .filter((p) => p.position === 'WR' && p.tier === 1);
    expect(wideOuts.length).toBeGreaterThan(1);

    // Everybody but the last of tier one, spread across teams so nobody fills up.
    wideOuts.slice(0, wideOuts.length - 1).forEach((player, index) => {
      service.draftPlayer(player.id, `team-${index + 2}`, 40);
    });
    expect(league.positionLimits.WR).toBeGreaterThan(1);

    const breaks = service.getTierBreaks();
    const wr = breaks.find((row) => row.position === 'WR')!;
    expect(wr.tier).toBe(1);
    expect(wr.left).toBe(1);
    expect(wr.last!.id).toBe(wideOuts[wideOuts.length - 1].id);
    expect(wr.pointStep).toBeGreaterThan(0);

    const alert = buildAlerts(service.getPlayers(), team(), service).find(
      (row) => row.kind === 'tier-break'
    )!;
    expect(alert.id).toBe('tier-break:WR:1');
    expect(alert.message).toContain(wr.last!.name);
    expect(alert.message).toContain(`${wr.pointStep} points`);
  });

  it('empties a tier on a snake pick exactly as on a bought one', () => {
    service.setAuctionSheet(smallSheet(service, 20));
    finishAuction(service);
    expect(service.getPhase()).toBe('snake');

    const before = service.getTierBreaks().find((row) => row.position === 'RB')!;
    const back = service
      .getAvailablePlayers()
      .filter((p) => p.position === 'RB' && p.tier === before.tier)
      .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
    service.draftSnakePick(back.id, service.getSnakeOnTheClock()!.team.id);

    const after = service.getTierBreaks().find((row) => row.position === 'RB')!;
    // Supply counts both halves: nobody paid for him and he is just as gone.
    expect(after.left).toBe(before.left - 1);
    expect(back.draftCost).toBeUndefined();
  });

  it('quotes a dollar step only where both sides of it are being auctioned', () => {
    service.setAuctionSheet(smallSheet(service, 30));
    for (const row of service.getTierBreaks()) {
      if (row.dollarStep == null) continue;
      // A $1 floor price is not a price anybody would pay, so a step measured
      // against one would invent a cliff the size of the whole tier.
      expect(row.dollarStep).toBeGreaterThanOrEqual(0);
    }
  });

  it('calls a run of one position, counting both halves of the draft', () => {
    const backs = service.getAvailablePlayers().filter((p) => p.position === 'RB');
    for (let i = 0; i < 6; i++) service.draftPlayer(backs[i].id, `team-${i + 1}`, 30);

    const run = service.getPositionRuns().find((row) => row.position === 'RB')!;
    expect(run.taken).toBe(6);
    expect(run.window).toBe(6);
    expect(run.share).toBe(1);
    expect(run.leftBefore).toBe(run.left + 6);

    const alert = buildAlerts(service.getPlayers(), team(), service).find(
      (row) => row.kind === 'position-run'
    )!;
    expect(alert.id).toBe('position-run:RB');
    expect(alert.message).toContain('6 of the last 6 picks');
  });

  it('counts what is left at a position by replacement level, so the snake does not read as empty', () => {
    service.setAuctionSheet(smallSheet(service, 20));
    finishAuction(service);

    // For-sale means on the sheet, and in the snake nobody left is. Counting
    // that way would report every position as empty and every pick as a run.
    for (const row of service.getPositionRuns()) {
      if (row.position === 'K' || row.position === 'DST') continue;
      expect(row.left).toBeGreaterThan(0);
    }
  });

  it('says nothing at all about an untouched board', () => {
    expect(buildAlerts(service.getPlayers(), team(), service)).toEqual([]);
    expect(service.getPositionRuns().every((row) => row.taken === 0)).toBe(true);
  });
});

describe('what the room read must never say', () => {
  /**
   * Every one of these shipped as a confident, wrong sentence on screen. That
   * is the failure mode this whole layer has to be held to: an edge that says
   * something false is worse than no edge, because it will be acted on.
   */
  beforeEach(() => localStorage.clear());

  const room = () => {
    const service = new AuctionDraftService(leagueShape({ teams: 12, budget: 200 }));
    service.setMyTeam('team-1');
    return service;
  };

  it('reports the owner’s own row even when their roster has no space', () => {
    // Testing the roster first and skipping meant `mine` came back null for a
    // team that was marked, so the panel told the owner to mark a team as
    // theirs — and counted their own team among the opponents with no room.
    const service = room();
    const limit = service.getLeagueShape().positionLimits.K;
    const kickers = service.getAvailablePlayers().filter((p) => p.position === 'K');
    for (let i = 0; i < limit; i++) service.draftPlayer(kickers[i].id, 'team-1', 1);

    const competition = service.getBidCompetition(kickers[limit].id, 0)!;
    expect(competition.mine).not.toBeNull();
    expect(competition.mine!.canRoster).toBe(false);
    expect(competition.mine!.team.id).toBe('team-1');
    // The owner is not one of their own opponents.
    expect(competition.blocked).toBe(0);
    expect(competition.rivals.some((rival) => rival.team.id === 'team-1')).toBe(false);
  });

  it('never nominates a player it protects in the same breath', () => {
    // The scarcity call took the dearest player at the thinnest position with
    // no exclusion, and the thinnest position is exactly where a watched player
    // tends to be.
    const service = room();
    const backs = service.getAvailablePlayers().filter((p) => p.position === 'RB');
    for (let i = 0; i < 14; i++) service.draftPlayer(backs[i].id, `team-${(i % 11) + 2}`, 1);

    const watched = service.getAvailablePlayers().find((p) => p.position === 'RB')!;
    const plan = adviseOnNomination(
      service.getPlayers(),
      service.getTeams().find((t) => t.id === 'team-1'),
      service,
      { watchlist: [watched.id] }
    );

    if (plan) {
      const held = new Set(plan.protect.map((row) => row.player.id));
      for (const call of plan.calls) expect(held.has(call.player.id)).toBe(false);
    }
  });

  it('keeps a reading when the bid has cleared everybody out', () => {
    // The section used to be gated on rivals alone, so it vanished at exactly
    // the bid where it had the most to say: the legal list still showed eleven
    // teams at $200 while the one fact that answered them was thrown away.
    const service = room();
    const player = service.getAvailablePlayers()[0];
    const read = readTheRoom(player, service, 150);

    expect(read).not.toBeNull();
    expect(read!.rivals.length).toBe(0);
    expect(read!.quiet).toBeGreaterThan(0);
  });

  it('says nothing below rather than a step of zero', () => {
    // "then −0 pts" reads as "no drop off this shelf", which is a different
    // claim from "there is no shelf below this one".
    const service = new AuctionDraftService(leagueShape({ auctionSheetSize: null }));
    for (const row of service.getTierBreaks()) {
      if (row.pointStep === null) continue;
      expect(row.pointStep).toBeGreaterThanOrEqual(0);
    }
    // The bottom tier of some position has nothing under it, and says so.
    expect(service.getTierBreaks().some((row) => row.pointStep === null)).toBe(true);
  });

  it('does not warn twice about the same tier', () => {
    const service = room();
    const wrs = service.getAvailablePlayers().filter((p) => p.position === 'WR');
    for (let i = 0; i < 3; i++) service.draftPlayer(wrs[i].id, `team-${i + 2}`, 5);

    const alerts = buildAlerts(service.getPlayers(), service.getTeams()[0], service);
    const subjects = alerts
      .filter((alert) => alert.kind === 'tier-cliff' || alert.kind === 'tier-break')
      .map((alert) => alert.id.split(':')[1]);
    expect(new Set(subjects).size).toBe(subjects.length);
  });
});
