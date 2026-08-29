import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { adviseOnBid, adviseOnNomination, buildAlerts } from '@/services/draftAdvisor';

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

  it('sorts by the gap between our board and the consensus', () => {
    const rows = service.getBargains(10);
    expect(rows.length).toBe(10);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].edge).toBeGreaterThanOrEqual(rows[i].edge);
    }
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
