import { beforeEach, describe, expect, it } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';

/**
 * The order somebody presses two buttons in must not change the board.
 *
 * Found driving a real commissioner's sheet. "Use consensus" reads dollar
 * values off our surplus curve for a board where the money buys 192 players;
 * importing a sheet re-prices that curve for a board where the same money buys
 * sixty. The overrides then held the old numbers and won, because a price the
 * owner stated beats a price we computed — so the whole sheet read about 35%
 * cheap, which is a board that loses every player while its owner believes he
 * is being disciplined.
 */
describe('sheet and market board, in either order', () => {
  let sheet: string[];

  const league = () =>
    leagueShape({
      teams: 12,
      budget: 200,
      rosterSize: 16,
      receptionPoints: 0.5,
      startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });

  const priced = (service: AuctionDraftService) =>
    service
      .getPlayers()
      .filter((player) => player.onSheet)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((player) => [player.id, player.estimatedValue] as const);

  beforeEach(() => {
    localStorage.clear();
    const seed = new AuctionDraftService(league());
    // The best sixty by our own board stands in for a commissioner's list.
    sheet = seed
      .getPlayers()
      .sort((a, b) => b.modelValue - a.modelValue)
      .slice(0, 60)
      .map((player) => player.id);
  });

  it('lands on the same prices whichever button is pressed first', () => {
    localStorage.clear();
    const first = new AuctionDraftService(league());
    first.setAuctionSheet(sheet);
    first.applyConsensusBoard();

    localStorage.clear();
    const second = new AuctionDraftService(league());
    second.applyConsensusBoard();
    second.setAuctionSheet(sheet);

    expect(priced(second)).toEqual(priced(first));
  });

  it('spends the room’s whole budget either way, not two thirds of it', () => {
    localStorage.clear();
    const service = new AuctionDraftService(league());
    service.applyConsensusBoard();
    service.setAuctionSheet(sheet);
    const total = service
      .getPlayers()
      .filter((player) => player.onSheet)
      .reduce((sum, player) => sum + player.estimatedValue, 0);
    // Twelve teams at $200. Rounding to whole dollars costs a few either way.
    expect(total).toBeGreaterThan(2300);
    expect(total).toBeLessThanOrEqual(2400);
  });

  it('never recomputes values somebody stated themselves', () => {
    // An imported CSV is the owner's own opinion. Only the market board is a
    // derivation from our curve, so only it may be re-derived.
    localStorage.clear();
    const service = new AuctionDraftService(league());
    const target = service.getPlayers()[0];
    service.setCustomRankings({ [target.id]: { value: 77, notes: 'mine' } });
    service.setAuctionSheet(sheet);
    expect(service.getPlayers().find((p) => p.id === target.id)?.estimatedValue).toBe(77);
  });

  it('re-derives again when the sheet is removed', () => {
    localStorage.clear();
    const service = new AuctionDraftService(league());
    service.applyConsensusBoard();
    const before = priced(service);
    service.setAuctionSheet(sheet);
    service.clearAuctionSheet();
    expect(priced(service)).toEqual(before);
  });
});
