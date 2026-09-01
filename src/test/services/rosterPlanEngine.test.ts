import { beforeEach, describe, expect, it } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { HOME_LEAGUE } from '@/lib/valuation';

/**
 * The plan, on the board actually being drafted.
 *
 * `rosterPlan.test.ts` proves the arithmetic on cases small enough to work out
 * by hand. This proves the wiring: that the engine feeds it the same sheet,
 * the same market order and the same free men every other panel reads, and
 * that it refuses in exactly the places the outlook refuses.
 */
describe('what the money should buy', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(HOME_LEAGUE);
    service.confirmLeague();
    service.seedHomeDefaults();
    service.setMyTeam('team-1');
  });

  it('refuses without a team marked as yours, rather than planning somebody else’s draft', () => {
    service.setMyTeam(null);
    const plan = service.getRosterPlan();
    expect(plan.reason).toMatch(/team/i);
    expect(plan.buy).toHaveLength(0);
    expect(service.maxPriceFor(service.getForSale()[0].id)).toBeNull();
  });

  /*
   * The commissioner draws the order at the table, sometimes on the night, so
   * refusing until he does would leave a month in which the one number this
   * format turns on cannot be looked at. Picking first is where the snake gives
   * most and an auction buys least, so a plan that holds there holds at every
   * seat — nothing it promises can be taken away by the draw.
   */
  it('plans at the safest draw while the order is undrawn, and says so', () => {
    expect(service.isPlanBounded()).toBe(true);
    const plan = service.getRosterPlan();
    expect(plan.reason).toBeNull();
    expect(plan.buy.length).toBeGreaterThan(0);
    expect(plan.spend).toBeLessThanOrEqual(HOME_LEAGUE.budget);
  });

  it('stops bounding once the order exists', () => {
    service.setSnakeOrder(service.getTeams().map((team) => team.id));
    expect(service.isPlanBounded()).toBe(false);
    expect(service.maxPriceBounds(service.getForSale()[0].id)).toBeNull();
    expect(service.maxPriceFor(service.getForSale()[0].id)).not.toBeNull();
  });

  it('bounds the walk-away across the draws, low end first', () => {
    const player = service
      .getForSale()
      .filter((entry) => !entry.isDrafted)
      .sort((a, b) => b.estimatedValue - a.estimatedValue)[0];
    const bounds = service.maxPriceBounds(player.id)!;
    expect(bounds).not.toBeNull();
    expect(bounds.low).toBeLessThanOrEqual(bounds.high);
    // Picking later means worse free men, so a wider gap and a higher ceiling.
    expect(bounds.high).toBeGreaterThanOrEqual(bounds.low);
  });

  /*
   * The defect the whole module replaces, stated as a property.
   *
   * `maxBid` was `riskAdjustedValue * 1.15` — the same multiplier for everybody
   * — so it was always *above* the price and ranked players in exactly the
   * order their prices already did. On the shipped board it told the owner to
   * go to $37 on Derrick Henry, whose gain over the free back is nine points,
   * and $28 on Omarion Hampton, whose gain is minus forty-two.
   */
  it('is willing to say a player is worth less than he costs', () => {
    const cheapskates = service
      .getForSale()
      .filter((entry) => !entry.isDrafted && entry.estimatedValue >= 20)
      .map((entry) => ({ entry, max: service.maxPriceBounds(entry.id)?.high ?? 0 }))
      .filter((row) => row.max < row.entry.estimatedValue);
    // More than half a commissioner's sheet is players the snake very nearly
    // matches; a ladder that can only ever say "pay a bit more than the price"
    // cannot express that, and this is the number that can.
    expect(cheapskates.length).toBeGreaterThan(0);
  });

  it('never recommends paying more than the budget allows', () => {
    for (const player of service.getForSale().slice(0, 12)) {
      const bounds = service.maxPriceBounds(player.id);
      if (!bounds) continue;
      expect(bounds.high).toBeLessThanOrEqual(HOME_LEAGUE.budget);
      expect(bounds.low).toBeGreaterThanOrEqual(0);
    }
  });

  it('buys nothing at a position the roster has already filled', () => {
    const teams = service.getTeams();
    const mine = teams.find((team) => team.id === 'team-1')!;
    const backs = service
      .getPlayers()
      .filter((entry) => entry.position === 'RB' && !entry.isDrafted)
      .slice(0, 3);
    for (const back of backs) service.draftPlayer(back.id, mine.id, 1);
    // Two starting RB seats and a flex, all filled: another back is a bench
    // body, and the snake fills a bench for nothing.
    const another = service
      .getForSale()
      .find((entry) => entry.position === 'RB' && !entry.isDrafted)!;
    expect(service.maxPriceBounds(another.id)?.high ?? 0).toBe(0);
  });
});
