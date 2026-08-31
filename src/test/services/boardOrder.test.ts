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

/**
 * A rank is an overall rank, and the board's default order is built on it.
 *
 * Found by looking at the room rather than at a number. `RankingOverride.rank`
 * is read out of a CSV column headed `rank`, `overall` or `ovr`; the profile
 * prints it as "#n overall"; the card board and the table both sort 628
 * players by it. `consensusOverrides` was writing a *within-position* index
 * into it, so every position had a rank 1 and the sort round-robined them —
 * the first six cards on the default board were the TE4 at $3 and the QB5 at
 * $1, sitting above Ja'Marr Chase and Bijan Robinson.
 *
 * It only appeared after pressing "Use consensus", which is the recommended
 * way to run the night, and every number on those cards was individually
 * correct. Nothing but the order was wrong, which is why no assertion had it.
 */
describe('the rank the market board writes', () => {
  const league = () =>
    leagueShape({
      teams: 12,
      budget: 100,
      rosterSize: 16,
      receptionPoints: 0.5,
      startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });

  it('is overall, so no two players share it', () => {
    localStorage.clear();
    const service = new AuctionDraftService(league());
    service.applyConsensusBoard();
    // Everybody the market has an opinion about. The rest keep our rank, which
    // is already overall, and the market-only names all sit at one sentinel.
    const ranked = service
      .getPlayers()
      .filter((player) => player.adp > 0 && player.adp < 600)
      .map((player) => player.adp);
    expect(ranked.length).toBeGreaterThan(300);
    expect(new Set(ranked).size).toBe(ranked.length);
  });

  it('puts the dearest players at the top of the default board, not one per position', () => {
    localStorage.clear();
    const service = new AuctionDraftService(league());
    service.applyConsensusBoard();
    const top = [...service.getAvailablePlayers()].sort((a, b) => a.adp - b.adp).slice(0, 12);

    // The specific shape of the bug: one of each position, over and over.
    const positions = new Set(top.map((player) => player.position));
    expect(positions.size).toBeLessThanOrEqual(3);

    // And the consequence that costs money — a $1 player above a $40 one.
    const dearest = Math.max(...service.getAvailablePlayers().map((p) => p.estimatedValue));
    expect(Math.min(...top.map((player) => player.estimatedValue))).toBeGreaterThan(dearest * 0.4);
  });
});
