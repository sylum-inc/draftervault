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
   * Where you pick is an input, not a precondition.
   *
   * The order is drawn at the table and often on the night, so refusing until
   * it exists leaves a month in which the number this format turns on cannot be
   * looked at. The draw is uniform and unknown, so the baseline is the expected
   * free man averaged over every seat — one plan, no caveat, and no question
   * the owner has to answer before the tool will work.
   */
  it('plans without a drawn order at all', () => {
    const plan = service.getRosterPlan();
    expect(plan.reason).toBeNull();
    expect(plan.buy.length).toBeGreaterThan(0);
    expect(plan.spend).toBeLessThanOrEqual(HOME_LEAGUE.budget);
  });

  it('uses the seat you were dealt once there is one', () => {
    const before = service.getRosterPlan().gain;
    // Picking last is the friendliest draw — the free men are worst, so the
    // gaps an auction can buy are widest — and it must move off the average.
    service.setSnakeOrder(
      service
        .getTeams()
        .map((team) => team.id)
        .reverse()
    );
    expect(service.getRosterPlan().gain).not.toBe(before);
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
      .map((entry) => ({ entry, max: service.maxPriceFor(entry.id) ?? 0 }))
      .filter((row) => row.max < row.entry.estimatedValue);
    // More than half a commissioner's sheet is players the snake very nearly
    // matches; a ladder that can only ever say "pay a bit more than the price"
    // cannot express that, and this is the number that can.
    expect(cheapskates.length).toBeGreaterThan(0);
  });

  it('never recommends paying more than the budget allows', () => {
    for (const player of service.getForSale().slice(0, 12)) {
      const price = service.maxPriceFor(player.id);
      if (price == null) continue;
      expect(price).toBeLessThanOrEqual(HOME_LEAGUE.budget);
      expect(price).toBeGreaterThanOrEqual(0);
    }
  });

  /*
   * A bench body is not a worthless one.
   *
   * The search used to force a bought player into a seat, so a man behind the
   * free alternative *reduced* the lineup and priced at zero — as though owning
   * him were self-harm. Nobody starts a player worse than the one the snake
   * handed them; you bench him, and benching costs the lineup nothing. What he
   * is worth is whatever the best lineup has no other use for, because an
   * unspent auction dollar scores nothing at all.
   */
  it('still prices a player every starting seat is already full of', () => {
    const mine = service.getTeams().find((team) => team.id === 'team-1')!;
    const backs = service
      .getPlayers()
      .filter((entry) => entry.position === 'RB' && !entry.isDrafted)
      .slice(0, 3);
    for (const back of backs) service.draftPlayer(back.id, mine.id, 1);
    const another = service
      .getForSale()
      .find((entry) => entry.position === 'RB' && !entry.isDrafted)!;
    const price = service.maxPriceFor(another.id)!;
    expect(price).toBe(service.getRosterPlan().slack);
  });

  it('is nothing only when the roster cannot legally carry him', () => {
    const mine = service.getTeams().find((team) => team.id === 'team-1')!;
    const limit = service.getLeagueShape().positionLimits.TE ?? 0;
    const ends = service
      .getPlayers()
      .filter((entry) => entry.position === 'TE' && !entry.isDrafted)
      .slice(0, limit);
    for (const end of ends) service.draftPlayer(end.id, mine.id, 1);
    const another = service
      .getForSale()
      .find((entry) => entry.position === 'TE' && !entry.isDrafted)!;
    expect(service.maxPriceFor(another.id)).toBe(0);
  });
});
