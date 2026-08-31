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
    // Neither source ranks the dollar tail, and pretending otherwise would be
    // inventing the one thing this defers to.
    expect(coverage.ranked).toBeGreaterThan(300);
    expect(coverage.ranked).toBeLessThan(coverage.of);
    expect(service.getCustomRankingCount()).toBe(coverage.ranked);
  });

  it('prefers real drafts to an analyst panel, and says which spoke', () => {
    // ADP is the signal the backtest measured; expert consensus was
    // substituted for it without evidence, and the two disagree at the top of
    // the board. Coverage is reported split so the panel cannot claim the
    // measured signal for players it did not cover.
    const coverage = service.applyConsensusBoard();
    expect(coverage.fromAdp).toBeGreaterThan(150);
    expect(coverage.fromConsensus).toBeGreaterThan(50);
    expect(coverage.fromAdp + coverage.fromConsensus).toBe(coverage.ranked);

    const priced = service
      .getPlayers()
      .filter((p) => p.customRanking)
      .sort((a, b) => b.estimatedValue - a.estimatedValue);
    // The dearest players are the ones real drafts had an opinion about.
    for (const player of priced.slice(0, 25)) {
      expect(player.customRanking?.notes).toBe('adp');
    }
  });

  it('sorts every drafted player ahead of one only the panel ranked', () => {
    // Real drafts stop caring after about 230 players; consensus ranks 383. A
    // player with a consensus rank and no ADP is by definition one the room
    // was not drafting, so he belongs after every ADP'd player at his
    // position — an ordering claim both sources agree on, rather than a splice
    // of two incompatible scales.
    service.applyConsensusBoard();
    const byPosition = new Map<string, { adp: number; consensus: number }>();
    for (const player of service.getPlayers()) {
      const notes = player.customRanking?.notes;
      if (!notes) continue;
      const seen = byPosition.get(player.position) ?? { adp: -1, consensus: Infinity };
      const rank = player.customRanking?.rank ?? 0;
      if (notes === 'adp') seen.adp = Math.max(seen.adp, rank);
      else seen.consensus = Math.min(seen.consensus, rank);
      byPosition.set(player.position, seen);
    }
    let checked = 0;
    for (const [, seen] of byPosition) {
      if (seen.adp < 0 || seen.consensus === Infinity) continue;
      expect(seen.consensus).toBeGreaterThan(seen.adp);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('carries a snapshot that names its source, sample and date', () => {
    const snapshot = service.getMarketSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.source).toMatch(/Fantasy Football Calculator/i);
    expect(snapshot!.scoring).toMatch(/half/i);
    expect(snapshot!.drafts).toBeGreaterThan(100);
    expect(snapshot!.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('previews coverage without changing a single price', () => {
    const before = service.getPlayers().map((p) => p.estimatedValue);
    const preview = service.previewConsensusBoard();
    expect(preview.ranked).toBeGreaterThan(300);
    expect(service.getPlayers().map((p) => p.estimatedValue)).toEqual(before);
    expect(service.getCustomRankingCount()).toBe(0);
  });

  it('actually reorders the board rather than restating it', () => {
    const before = new Map(service.getPlayers().map((p) => [p.id, p.estimatedValue]));
    service.applyConsensusBoard();
    const moved = service.getPlayers().filter((p) => before.get(p.id) !== p.estimatedValue);
    expect(moved.length).toBeGreaterThan(50);
  });

  it('keeps our own number visible beside theirs', () => {
    service.applyConsensusBoard();
    // Every player carries an override now, because the board is drawn in one
    // order and everybody has to have a place in it. Only the ones the market
    // priced carry a `value`, and those are the ones this is about.
    const repriced = service.getPlayers().filter((p) => p.customRanking?.value != null);
    expect(repriced.length).toBeGreaterThan(300);
    expect(service.getCustomRankingCount()).toBe(repriced.length);
    for (const player of repriced.slice(0, 40)) {
      expect(player.modelValue).toBeGreaterThan(0);
      expect(['adp', 'consensus']).toContain(player.customRanking?.notes);
    }
    // And a player the market never spoke for keeps our number, with no source
    // claimed for it.
    const untouched = service.getPlayers().filter((p) => p.customRanking?.value == null);
    for (const player of untouched.slice(0, 20)) {
      expect(player.estimatedValue).toBe(player.modelValue);
      expect(player.customRanking?.notes).toBeUndefined();
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
