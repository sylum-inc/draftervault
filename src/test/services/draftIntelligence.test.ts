import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { adviseOnBid, adviseOnNomination, buildAlerts } from '@/services/draftAdvisor';
import { inflatedPrice } from '@/lib/valuation';

const firstAvailable = (service: AuctionDraftService, position?: string) =>
  service.getAvailablePlayers().find((p) => !position || p.position === position)!;

describe('pool data', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  it('carries advanced usage for the players who have it', () => {
    const withUsage = service.getPlayers().filter((p) => p.usage?.targetShare != null);
    expect(withUsage.length).toBeGreaterThan(100);

    for (const player of withUsage) {
      // Shares are percentages of a team's own volume, so anything outside 0-100
      // means a denominator went wrong in the builder.
      expect(player.usage!.targetShare!).toBeGreaterThanOrEqual(0);
      expect(player.usage!.targetShare!).toBeLessThanOrEqual(100);
    }
  });

  it('never reports more red-zone touches than the player had games to get them in', () => {
    for (const player of service.getPlayers()) {
      if (!player.usage) continue;
      expect(player.usage.goalLineTouches).toBeLessThanOrEqual(player.usage.redZoneTouches);
    }
  });

  it('gives every offence a plausible play count', () => {
    const contexts = service
      .getPlayers()
      .map((p) => p.teamContext)
      .filter(Boolean);
    expect(contexts.length).toBeGreaterThan(400);
    for (const context of contexts) {
      // No NFL offence runs fewer than 45 or more than 80 plays a game.
      expect(context!.playsPerGame).toBeGreaterThan(45);
      expect(context!.playsPerGame).toBeLessThan(80);
    }
  });

  it('reports market edge as consensus minus our own rank', () => {
    const ranked = service.getPlayers().filter((p) => p.market?.consensusRank != null);
    expect(ranked.length).toBeGreaterThan(200);
    for (const player of ranked) {
      expect(player.market!.edge).toBe(player.market!.consensusRank! - player.adp);
    }
  });

  it('keeps the expert range around the consensus', () => {
    for (const player of service.getPlayers()) {
      const market = player.market;
      if (market?.best == null || market.worst == null) continue;
      expect(market.best).toBeLessThanOrEqual(market.worst);
    }
  });

  it('knows replacement level for every position', () => {
    for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const) {
      expect(service.getReplacementLevel(position)).toBeGreaterThan(0);
    }
  });
});

describe('spend simulation', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  it('holds back a dollar per open starting slot, exactly as validateBid does', () => {
    const simulation = service.simulateSpend('team-1', 100);
    // Nothing drafted yet: nine starters, one of which this bid is for.
    expect(simulation!.minimumHold).toBe(8);
    expect(simulation!.remaining).toBe(100);
    expect(simulation!.legal).toBe(true);
  });

  it('agrees with validateBid about what is affordable', () => {
    const player = firstAvailable(service);
    const simulation = service.simulateSpend('team-1', 193);
    expect(simulation!.legal).toBe(false);
    expect(service.validateBid(player.id, 'team-1', 193).ok).toBe(false);

    expect(service.simulateSpend('team-1', 192)!.legal).toBe(true);
    expect(service.validateBid(player.id, 'team-1', 192).ok).toBe(true);
  });

  it('recomputes once money is actually spent', () => {
    const player = firstAvailable(service);
    service.draftPlayer(player.id, 'team-1', 40);
    const simulation = service.simulateSpend('team-1', 10);
    expect(simulation!.remaining).toBe(150);
    // Eight starting slots left, one covered by this bid.
    expect(simulation!.minimumHold).toBe(7);
  });
});

describe('bargain board', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  it('sorts by what the disagreement is worth in dollars, not by rank gap', () => {
    const rows = service.getBargains(10);
    expect(rows.length).toBe(10);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].gap).toBeGreaterThanOrEqual(rows[i].gap);
    }
  });

  it('does not lead with dollar players the consensus happens to rank far lower', () => {
    // The old sort was on `market.edge`, a difference of ranks, which put a $2
    // bench receiver 160 places below us at the top of a panel about bargains.
    // A hundred and sixty places there is worth a dollar: below the top hundred
    // both boards are ranking noise, and the gap measures how little either
    // knows rather than how much money is on the table.
    const rows = service.getBargains(10);
    const dearest = Math.max(...rows.map((row) => row.player.modelValue));
    expect(dearest).toBeGreaterThan(10);
    const byRank = [...rows].sort((a, b) => b.edge - a.edge);
    expect(byRank[0].player.id).not.toBe(rows[0].player.id);
  });

  it('quotes a price the room would pay, taken from the market’s number', () => {
    // The old arithmetic claimed the expected price tracks the market rank and
    // then computed it from ours, making up the difference with a bare
    // `edge * 0.12` that nobody derived.
    const inflation = service.getInflationBasis().inflation;
    for (const row of service.getBargains(8)) {
      const theirs = row.player.modelValue - row.gap;
      // The room's price is their number moved by the room's inflation, and it
      // goes through the same `inflatedPrice` the stage and the table print —
      // so the saving quoted here cannot disagree with the price on screen.
      expect(row.projectedCost).toBe(inflatedPrice(theirs, inflation));
      expect(row.saving).toBe(row.player.modelValue - row.projectedCost);
    }
  });

  it('measures the disagreement against our own board, not the applied one', () => {
    // Otherwise pressing "Use consensus" would re-derive the gap against the
    // consensus board itself and report that we agree with everybody about
    // everything. The row *set* legitimately shrinks — a player consensus
    // prices at a dollar stops being a bargain candidate, which is `forSale`
    // doing its job — so the invariant is per player, not per list.
    const before = new Map(service.getBargains(30).map((row) => [row.player.id, row.gap]));
    expect(before.size).toBeGreaterThan(10);
    service.applyConsensusBoard();
    const after = service.getBargains(30);
    expect(after.length).toBeGreaterThan(5);
    let compared = 0;
    for (const row of after) {
      if (!before.has(row.player.id)) continue;
      expect(row.gap).toBe(before.get(row.player.id));
      compared += 1;
    }
    expect(compared).toBeGreaterThan(5);
  });

  it('drops players once they are drafted', () => {
    const [top] = service.getBargains(1);
    service.draftPlayer(top.player.id, 'team-1', 5);
    expect(service.getBargains(30).some((row) => row.player.id === top.player.id)).toBe(false);
  });
});

describe('the advisor', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  it('walks away above the maximum bid', () => {
    const player = firstAvailable(service);
    const team = service.getTeams()[0];
    const analytics = service.getPlayerAnalytics(player.id, team.id);
    const advice = adviseOnBid(player, team, analytics, service, analytics.maxBid + 5);

    expect(advice!.verdict).toBe('PASS');
    expect(advice!.reasons.length).toBeGreaterThan(0);
  });

  it('calls a bid under the target good value', () => {
    const player = firstAvailable(service);
    const team = service.getTeams()[0];
    const analytics = service.getPlayerAnalytics(player.id, team.id);
    const advice = adviseOnBid(player, team, analytics, service, 1);

    expect(advice!.verdict).toBe('VALUE');
  });

  it('always explains itself', () => {
    const team = service.getTeams()[0];
    for (const player of service.getAvailablePlayers().slice(0, 40)) {
      const analytics = service.getPlayerAnalytics(player.id, team.id);
      const advice = adviseOnBid(player, team, analytics, service, analytics.targetBid);
      expect(advice!.reasons.length).toBeGreaterThan(0);
      expect(advice!.stopAt).toBeGreaterThan(0);
    }
  });

  it('nominates a player the roster does not need while budgets are full', () => {
    const team = service.getTeams()[0];
    const plan = adviseOnNomination(service.getPlayers(), team, service);
    expect(plan).not.toBeNull();
    // The plan now carries a short list rather than one name, but the first
    // call on an untouched board is still the drain — that half was right.
    expect(plan!.calls[0].kind).toBe('drain');
    expect(plan!.calls[0].reason).toContain('Nominate the money away');
  });

  it('produces no alerts on an untouched board', () => {
    expect(buildAlerts(service.getPlayers(), service.getTeams()[0], service)).toEqual([]);
  });

  it('returns nothing without a team', () => {
    const player = firstAvailable(service);
    const analytics = service.getPlayerAnalytics(player.id, 'team-1');
    expect(adviseOnBid(player, undefined, analytics, service, 10)).toBeNull();
    expect(adviseOnNomination(service.getPlayers(), undefined, service)).toBeNull();
  });
});

describe('the league board', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  it('groups every pick under the team that made it', () => {
    const players = service.getAvailablePlayers();
    service.draftPlayer(players[0].id, 'team-1', 30);
    service.draftPlayer(players[1].id, 'team-2', 20);
    service.draftPlayer(players[2].id, 'team-1', 10);

    const board = service.getDraftBoard();
    expect(board.find((row) => row.team.id === 'team-1')!.picks).toHaveLength(2);
    expect(board.find((row) => row.team.id === 'team-2')!.picks).toHaveLength(1);
    expect(board.find((row) => row.team.id === 'team-3')!.picks).toHaveLength(0);
  });

  it('keeps picks in the order they happened', () => {
    const players = service.getAvailablePlayers();
    service.draftPlayer(players[0].id, 'team-1', 30);
    service.draftPlayer(players[1].id, 'team-1', 20);

    const picks = service.getDraftBoard().find((row) => row.team.id === 'team-1')!.picks;
    expect(picks[0].pickNumber).toBeLessThan(picks[1].pickNumber);
  });
});
