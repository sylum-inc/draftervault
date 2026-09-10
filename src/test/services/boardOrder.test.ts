import { beforeEach, describe, expect, it } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';
import { readAuctionSheet, sheetPlayerIds } from '@/lib/auctionSheet';
/** The commissioner's real sixty. See `src/test/fixtures/README.md`. */
import REAL_SHEET from '../../data/league/auction-sheet.txt?raw';

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

/**
 * What is for sale is what the sheet says, not what our prices imply.
 *
 * `forSale` was `onSheet && estimatedValue > 1`, and the doc block above it
 * already explained why the price half is wrong — then kept it anded on. A
 * commissioner's list legitimately holds players we price at a dollar; that is
 * the whole difference between a list and a size, and it is the case the
 * import exists for. Five of the owner's real sixty were dropped from
 * everything that counts what is for sale: the panel read "still for sale
 * 47/55" over a sixty-name sheet, par was computed over 55 and came out high,
 * and `adviseOnNomination` could never put any of the five on the block.
 *
 * The proxy is right in exactly one case and stays there: with no sheet at all
 * `onSheet` is everybody, because `pricePool` has no list to mask with, so
 * whether the money is chasing a player has to be inferred and the dollar
 * floor is the only signal there is.
 */
describe('what counts as for sale', () => {
  const league = () =>
    leagueShape({
      teams: 12,
      budget: 100,
      rosterSize: 16,
      receptionPoints: 0.5,
      startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });

  it('is every name on the list, dollar players included', () => {
    localStorage.clear();
    const service = new AuctionDraftService(league());
    const candidates = service
      .getPlayers()
      .map((p) => ({ id: p.id, name: p.name, position: p.position, team: p.team }));
    const parsed = readAuctionSheet(REAL_SHEET, candidates);
    service.setAuctionSheet(sheetPlayerIds(parsed.resolutions, {}));
    service.applyConsensusBoard();

    const onSheet = service.getPlayers().filter((player) => player.onSheet);
    expect(onSheet).toHaveLength(60);
    expect(service.getForSale()).toHaveLength(60);
    // And the ones that used to fall out are really there.
    expect(onSheet.filter((player) => player.estimatedValue <= 1).length).toBeGreaterThan(0);
  });

  it('opens at an inflation of exactly one, which is what pricing the sheet means', () => {
    // `pricePool` spreads the room's whole budget across the sheet, so before
    // anybody has bid, money left must equal value left. Dropping five players
    // out of the denominator broke that quietly — it opened at 1.004 — and a
    // multiplier that is wrong at the start is wrong all night.
    localStorage.clear();
    const service = new AuctionDraftService(league());
    const candidates = service
      .getPlayers()
      .map((p) => ({ id: p.id, name: p.name, position: p.position, team: p.team }));
    service.setAuctionSheet(
      sheetPlayerIds(readAuctionSheet(REAL_SHEET, candidates).resolutions, {})
    );
    const basis = service.getInflationBasis();
    expect(basis.forSaleLeft).toBe(60);
    // Within the rounding, not to the cent: sixty prices are rounded to whole
    // dollars, so the sum lands a few either side of the budget. The size of
    // the tolerance is the point — a few dollars is rounding, and one missing
    // player is at least the dollar floor times however many were dropped,
    // which the five this was written for made $5 and a real sheet could make
    // far more.
    expect(Math.abs(basis.valueLeft - basis.moneyLeft)).toBeLessThan(5);
    // 1.003 rather than 1.000, which is the same whole-dollar rounding read as
    // a ratio. The five dropped players put it at 1.004 — indistinguishable by
    // eye and not by arithmetic, which is why the counts above are what this
    // actually rests on.
    expect(service.getInflationBasis().inflation).toBeCloseTo(1, 2);
    expect(service.getEndgame().par).toBe(20);
  });

  it('still infers it from the floor when the whole board is auctioned', () => {
    // No list means `onSheet` is everybody, so without the price clause this
    // would call four hundred dollar players an auction.
    localStorage.clear();
    const full = new AuctionDraftService(
      leagueShape({ teams: 12, budget: 100, auctionSheetSize: null })
    );
    expect(full.getPlayers().every((player) => player.onSheet)).toBe(true);
    expect(full.getForSale().length).toBeLessThan(200);
    expect(full.getForSale().every((player) => player.estimatedValue > 1)).toBe(true);
  });
});
