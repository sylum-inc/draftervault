import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';

/**
 * The live half of a player card.
 *
 * Everything else the board shows is a fact about a player and reads the same
 * at pick one and at pick a hundred and fifty. These four readings are the ones
 * that move, and an instrument that does not move is decoration — so what is
 * pinned here is the movement, not the opening value.
 */
describe('what the draft has done to each position', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
    service.seedHomeDefaults();
  });

  const rb = () => service.getPositionPulse().get('RB')!;
  const topBacks = (count: number) =>
    service
      .getAvailablePlayers()
      .filter((player) => player.position === 'RB')
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .slice(0, count);

  it('empties the shelf as the room buys the position', () => {
    const before = rb();
    expect(before.shelf.length).toBeGreaterThan(4);
    expect(before.shelf[0]).toBeGreaterThan(before.shelf[1]);

    const [best] = topBacks(1);
    service.draftPlayer(best.id, 'team-3', 40);

    const after = rb();
    expect(after.left).toBe(before.left - 1);
    expect(after.startable).toBe(before.startable - 1);
    // The man at the top of the shelf is gone, so everybody moves up one.
    expect(after.shelf[0]).toBe(before.shelf[1]);
  });

  it('leaves another position’s supply alone, and moves its money', () => {
    /*
     * The two halves of a pulse behave differently on purpose, and this pins
     * which is which — it was written the other way round first, asserting the
     * whole reading held, and the failure was the more interesting answer.
     *
     * Supply is local: buying a running back takes nothing off the receiver
     * shelf and is not a run on receivers. Money is not local at all — the
     * forty dollars that team spent is forty dollars it cannot spend on a
     * receiver either, so every position's ceilings move on every sale. Which
     * means the board really does have to re-render on a pick, and the honest
     * thing is to measure that rather than to claim it away.
     */
    const before = service.getPositionPulse().get('WR')!;
    service.draftPlayer(topBacks(1)[0].id, 'team-3', 40);
    const after = service.getPositionPulse().get('WR')!;

    expect(after.shelf).toEqual(before.shelf);
    expect(after.left).toBe(before.left);
    expect(after.startable).toBe(before.startable);
    expect(after.goneRecently).toBe(0);

    expect(after.rivals).not.toEqual(before.rivals);
    expect(Math.max(...after.rivals)).toBe(Math.max(...before.rivals));
    expect(Math.min(...after.rivals)).toBeLessThan(Math.min(...before.rivals));
  });

  it('counts a run over the last ten picks, in either half of the draft', () => {
    expect(rb().goneRecently).toBe(0);

    const backs = topBacks(4);
    backs.forEach((player, index) => service.draftPlayer(player.id, `team-${index + 2}`, 30));

    const after = rb();
    expect(after.goneRecently).toBe(4);
    expect(after.window).toBe(4);
    // A receiver going does not make it a run on backs.
    const receiver = service
      .getAvailablePlayers()
      .find((player) => player.position === 'WR' && player.onSheet)!;
    service.draftPlayer(receiver.id, 'team-7', 20);
    expect(rb().goneRecently).toBe(4);
    expect(rb().window).toBe(5);
  });

  it('forgets a run once it has scrolled out of the window', () => {
    topBacks(2).forEach((player, index) => service.draftPlayer(player.id, `team-${index + 2}`, 25));
    expect(rb().goneRecently).toBe(2);

    // Ten receivers later those two backs are off the end of the tape.
    service
      .getAvailablePlayers()
      .filter((player) => player.position === 'WR' && player.onSheet)
      .slice(0, 10)
      .forEach((player, index) => service.draftPlayer(player.id, `team-${(index % 11) + 2}`, 3));

    expect(rb().goneRecently).toBe(0);
    expect(rb().window).toBe(10);
  });

  it('fills your own seats as you buy them, and opens the flex when they are gone', () => {
    const mine = service.getMyTeamId()!;
    expect(rb().slotsFilled).toBe(0);
    expect(rb().slotsTotal).toBe(2);

    const backs = topBacks(3);
    service.draftPlayer(backs[0].id, mine, 20);
    expect(rb().slotsFilled).toBe(1);

    service.draftPlayer(backs[1].id, mine, 15);
    const full = rb();
    expect(full.slotsFilled).toBe(2);
    // Both starting seats gone, so the next back is competing for the flex.
    expect(full.flexOpen).toBe(true);

    service.draftPlayer(backs[2].id, mine, 10);
    expect(rb().flexOpen).toBe(false);
  });

  it('never counts a seat past what the league fields', () => {
    const mine = service.getMyTeamId()!;
    topBacks(4).forEach((player) => service.draftPlayer(player.id, mine, 5));
    const pulse = rb();
    expect(pulse.slotsFilled).toBe(pulse.slotsTotal);
  });

  it('reports ceilings the engine would actually accept', () => {
    const mine = service.getMyTeamId()!;
    const pulse = rb();
    const target = topBacks(1)[0];

    // The number a card prints has to be the number a bid clears. A ceiling the
    // room reads and the engine then refuses is worse than no ceiling at all.
    expect(service.validateBid(target.id, mine, pulse.myCeiling).ok).toBe(true);
    expect(service.validateBid(target.id, mine, pulse.myCeiling + 1).ok).toBe(false);
  });

  it('drops a rival out of the money as they spend, and out entirely when full', () => {
    const before = rb();
    expect(before.rivals).toHaveLength(11);
    expect(Math.max(...before.rivals)).toBe(100);

    const backs = topBacks(4);
    service.draftPlayer(backs[0].id, 'team-4', 70);
    const spent = rb();
    // That team can no longer reach what it could before.
    expect(Math.min(...spent.rivals)).toBeLessThan(Math.min(...before.rivals) + 1);
    expect(spent.rivals).toHaveLength(11);

    // Filling their position limit removes them from the list rather than
    // listing them at nothing: they are not a quiet bidder, they cannot bid.
    const limit = service.getLeagueShape().positionLimits.RB;
    const fillers = service
      .getAvailablePlayers()
      .filter((player) => player.position === 'RB')
      .slice(0, limit);
    fillers.forEach((player) => service.draftPlayer(player.id, 'team-9', 1));
    expect(rb().rivals).toHaveLength(10);
  });

  it('refuses nothing when no team is marked, but reports no seats of its own', () => {
    service.setMyTeam(null);
    const pulse = rb();
    expect(pulse.slotsFilled).toBe(0);
    expect(pulse.flexOpen).toBe(false);
    // Every team is now an opponent, which is the honest reading of "nobody is
    // me" rather than a refusal — the shelf and the run are still true.
    expect(pulse.rivals).toHaveLength(12);
    expect(pulse.shelf.length).toBeGreaterThan(0);
  });
});
