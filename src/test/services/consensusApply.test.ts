import { beforeEach, describe, expect, it } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';

/**
 * The board the backtest preferred, driven against the real shipped pool.
 *
 * These are the properties that make it safe to reach for on the night rather
 * than the arithmetic, which `consensusBoard.test.ts` already pins.
 */
describe('applyConsensusBoard', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  it('speaks for the players the market ranks, and says how many that is', () => {
    const coverage = service.applyConsensusBoard();
    expect(coverage.of).toBeGreaterThan(600);
    // FantasyPros does not rank the dollar tail, and pretending otherwise
    // would be inventing the one thing this defers to.
    expect(coverage.ranked).toBeGreaterThan(300);
    expect(coverage.ranked).toBeLessThan(coverage.of);
    expect(service.getCustomRankingCount()).toBe(coverage.ranked);
  });

  it('actually reorders the board rather than restating it', () => {
    const before = new Map(service.getPlayers().map((p) => [p.id, p.estimatedValue]));
    service.applyConsensusBoard();
    const moved = service.getPlayers().filter((p) => before.get(p.id) !== p.estimatedValue);
    expect(moved.length).toBeGreaterThan(50);
  });

  it('keeps our own number visible beside theirs', () => {
    service.applyConsensusBoard();
    const players = service.getPlayers().filter((p) => p.customRanking);
    expect(players.length).toBeGreaterThan(300);
    for (const player of players.slice(0, 40)) {
      expect(player.modelValue).toBeGreaterThan(0);
      expect(player.customRanking?.notes).toBe('consensus');
    }
  });

  it('spends the same money it was spending, position by position', () => {
    const total = (pick: (id: string) => number) =>
      service
        .getPlayers()
        .filter((p) => p.customRanking)
        .reduce((sum, p) => sum + pick(p.id), 0);
    service.applyConsensusBoard();
    const players = service.getPlayers().filter((p) => p.customRanking);
    const ours = players.reduce((sum, p) => sum + p.modelValue, 0);
    const theirs = total((id) => players.find((p) => p.id === id)?.estimatedValue ?? 0);
    expect(theirs).toBe(ours);
  });

  it('is idempotent — applying it twice lands where applying it once did', () => {
    // It reads `modelValue` rather than the live price for exactly this. Off
    // the live price, a second apply would re-order an already-re-ordered
    // board and drift a little further every time somebody pressed it.
    service.applyConsensusBoard();
    const once = service.getPlayers().map((p) => [p.id, p.estimatedValue] as const);
    service.applyConsensusBoard();
    const twice = service.getPlayers().map((p) => [p.id, p.estimatedValue] as const);
    expect(twice).toEqual(once);
  });

  it('goes back to our board when cleared', () => {
    const before = service.getPlayers().map((p) => [p.id, p.estimatedValue] as const);
    service.applyConsensusBoard();
    service.clearCustomRankings();
    expect(service.getPlayers().map((p) => [p.id, p.estimatedValue] as const)).toEqual(before);
  });

  it('does not throw away a draft in progress, as a league change would', () => {
    const target = service
      .getPlayers()
      .find((p) => !p.isDrafted && p.market?.consensusRank != null);
    expect(service.draftPlayer(target!.id, service.getTeams()[0].id, 5)).toBe(true);
    const spentBefore = service.getTeams()[0].spent;
    service.applyConsensusBoard();
    expect(service.getDraftedPlayers().length).toBe(1);
    // The money spent is still the money spent; only what the players still on
    // the board are said to be worth has moved.
    expect(service.getTeams()[0].spent).toBe(spentBefore);
    expect(service.getPlayers().find((p) => p.id === target!.id)?.draftCost).toBe(5);
  });
});
