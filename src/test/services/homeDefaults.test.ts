import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DEFAULT_LEAGUE, HOME_LEAGUE, leagueShape, sameLeague } from '@/lib/valuation';

/**
 * The board this build opens on, with nobody having typed anything.
 *
 * Three things used to have to be done by hand before the board meant
 * anything — confirm the league, paste sixty names, press "Use consensus" —
 * and all three had to be repeated on every fresh browser, including the
 * published artifact on a phone, which is the machine this gets opened on when
 * the laptop has died. These pin the defaults that replaced them, and, more
 * importantly, pin the cases where seeding must *not* happen: a default that
 * reapplies itself is not a default, it is an action that overrules its owner.
 */
describe('the board a fresh browser opens on', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prices at the league being played, not the one the pool was built at', () => {
    const service = new AuctionDraftService();

    expect(service.getTeams()).toHaveLength(12);
    expect(service.getTeams()[0].budget).toBe(100);
    expect(service.getLeagueShape().receptionPoints).toBe(0.5);
    expect(service.getLeagueShape().startingLineup.FLEX).toBe(1);
    // The pool's own shape is a different fact and is still recorded as one.
    expect(sameLeague(service.getPoolLeagueShape(), DEFAULT_LEAGUE)).toBe(true);
  });

  it('seeds the commissioner’s sheet and the market board', () => {
    const service = new AuctionDraftService();
    const seeded = service.seedHomeDefaults();

    expect(seeded).not.toBeNull();
    // Resolved through the panel's own parser, so this is however many of the
    // bundled sixty this pool actually knows — not a number typed here.
    expect(seeded!.sheet).toBeGreaterThan(50);
    expect(service.getSheetCount()).toBe(seeded!.sheet);
    expect(service.getLeagueShape().auctionSheetSize).toBe(seeded!.sheet);
    // Sixty, not the 390 "Use consensus" reports on a whole board: with a sheet
    // in force the permutation stays inside the auction, because reordering
    // across the boundary hands an off-sheet player real dollars and leaks the
    // room's budget onto men nobody will bid on. Every one of them comes from
    // real drafts rather than from expert consensus, which is the signal the
    // backtest actually measured.
    expect(seeded!.market).toBe(seeded!.sheet);
  });

  it('prices the sheet, not the whole board — which is the point of seeding it', () => {
    const bare = new AuctionDraftService();
    const before = Math.max(...bare.getPlayers().map((p) => p.estimatedValue));

    const service = new AuctionDraftService();
    service.seedHomeDefaults();
    const after = Math.max(...service.getPlayers().map((p) => p.estimatedValue));

    // The same money chasing sixty players rather than the whole board is the
    // single largest input to a price in this format. If seeding ever silently
    // stopped applying, this is the number that would say so.
    expect(after).toBeGreaterThan(before * 1.5);
  });

  it('never bids more than a whole budget, at the league it seeds', () => {
    const service = new AuctionDraftService();
    service.seedHomeDefaults();

    const dearest = Math.max(...service.getPlayers().map((p) => p.estimatedValue));
    expect(dearest).toBeLessThan(HOME_LEAGUE.budget);
  });

  it('seeds once and then never again, so clearing the sheet sticks', () => {
    const service = new AuctionDraftService();
    expect(service.seedHomeDefaults()).not.toBeNull();

    service.clearAuctionSheet();
    expect(service.getSheetCount()).toBe(0);

    // A reload: a new service over the same storage.
    const reloaded = new AuctionDraftService();
    expect(reloaded.seedHomeDefaults()).toBeNull();
    expect(reloaded.getSheetCount()).toBe(0);
  });

  it('leaves a draft in progress completely alone', () => {
    const service = new AuctionDraftService(leagueShape());
    service.confirmLeague();
    const player = service.getAvailablePlayers()[0];
    service.draftPlayer(player.id, 'team-1', 30);

    // The order the app calls these in: restore first, seed second. A browser
    // that came back holding an afternoon's work must not have a sheet applied
    // underneath it — every pick was bid at prices a sheet moves.
    const resumed = new AuctionDraftService();
    expect(resumed.restore()).toBe(1);
    expect(resumed.seedHomeDefaults()).toBeNull();
    expect(resumed.getSheetCount()).toBe(0);
    expect(resumed.getDraftedPlayers()).toHaveLength(1);
  });

  it('leaves an imported sheet alone', () => {
    const service = new AuctionDraftService();
    const ids = service
      .getAvailablePlayers()
      .slice(0, 40)
      .map((p) => p.id);
    service.setAuctionSheet(ids);

    const reloaded = new AuctionDraftService();
    expect(reloaded.seedHomeDefaults()).toBeNull();
    expect(reloaded.getSheetCount()).toBe(40);
  });

  it('leaves imported rankings alone', () => {
    const service = new AuctionDraftService();
    const player = service.getAvailablePlayers()[0];
    service.setCustomRankings({ [player.id]: { value: 42, rank: 1 } });

    const reloaded = new AuctionDraftService();
    expect(reloaded.seedHomeDefaults()).toBeNull();
    expect(reloaded.getSheetCount()).toBe(0);
  });

  it('applies the sheet before the market board, never the other way round', () => {
    // The bug this order exists for: "Use consensus" reads dollars off the
    // surplus curve for the board in force, and a sheet re-prices that curve
    // for a board where the same money buys sixty. Seeded the wrong way round
    // the whole sheet reads about a third cheap, which is a board that loses
    // every player while its owner believes he is being disciplined.
    const seeded = new AuctionDraftService();
    seeded.seedHomeDefaults();

    localStorage.clear();
    const byHand = new AuctionDraftService();
    byHand.setAuctionSheet(
      // The same list, through the same door a paste comes through.
      seeded
        .getPlayers()
        .filter((p) => p.onSheet)
        .map((p) => p.id)
    );
    byHand.applyConsensusBoard();

    const priceOf = (service: AuctionDraftService) =>
      new Map(service.getPlayers().map((p) => [p.id, p.estimatedValue]));
    const a = priceOf(seeded);
    const b = priceOf(byHand);
    const differing = [...a].filter(([id, value]) => b.get(id) !== value);
    expect(differing).toEqual([]);
  });
});

/**
 * The order has to have been drawn before the outlook claims a seat.
 *
 * `getSnakeOrder` backfills every team that is missing, so it is never empty
 * and the guard that read its length was dead. The outlook was therefore
 * computed at the team order — the owner is team one, so it reported the
 * earliest possible draw, where the free man is best and a bid buys least.
 */
describe('where you pick, before the commissioner has drawn it', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const seeded = () => {
    const service = new AuctionDraftService();
    service.seedHomeDefaults();
    return service;
  };

  it('does not claim a seat nobody has been given', () => {
    const service = seeded();

    expect(service.hasSnakeOrder()).toBe(false);
    // Non-empty all the same, which is right for putting somebody on the clock
    // and is exactly why it cannot answer this question.
    expect(service.getSnakeOrder()).toHaveLength(12);
    expect(service.getSpendOutlook().positions).toBeNull();
    expect(service.getSpendOutlook().atOverall).toBeNull();
  });

  it('bounds it instead, and the bound contains the answer for every seat', () => {
    const service = seeded();
    const spread = service.getSpendSpread();
    expect(spread.positions).not.toBeNull();

    // Running back is the position the draw actually decides — the room takes
    // backs first once the sheet is gone, so a late seat loses the best free
    // one and a bid there buys more. Quarterback, counter-intuitively, does
    // not move at all: nobody reaches for a one-starter position in round one.
    const rb = spread.positions!.find((row) => row.position === 'RB')!;
    expect(rb.settled).toBe(false);
    expect(rb.high).toBeGreaterThan(rb.low);
    expect(spread.positions!.find((row) => row.position === 'QB')!.settled).toBe(true);

    // And it must actually contain what the outlook prints once an order exists.
    const teams = service.getTeams();
    for (const seat of [0, 5, 11]) {
      service.setSnakeOrder([
        teams[seat].id,
        ...teams.filter((_, i) => i !== seat).map((team) => team.id),
      ]);
      // Reordering puts our team wherever we ask, so this walks the real draws.
      service.setMyTeam(teams[seat].id);
      service.setSnakeOrder([
        ...teams.slice(0, seat).map((t) => t.id),
        teams[seat].id,
        ...teams.slice(seat + 1).map((t) => t.id),
      ]);
      const exact = service.getSpendOutlook().positions!.find((row) => row.position === 'RB')!;
      expect(exact.gain).toBeGreaterThanOrEqual(rb.low);
      expect(exact.gain).toBeLessThanOrEqual(rb.high);
    }
  });

  it('collapses to one number the moment an order is drawn', () => {
    const service = seeded();
    service.setSnakeOrder(service.getTeams().map((team) => team.id));

    expect(service.hasSnakeOrder()).toBe(true);
    expect(service.getSpendOutlook().positions).not.toBeNull();
    expect(service.getSpendOutlook().atOverall).toBe(1);
  });
});
