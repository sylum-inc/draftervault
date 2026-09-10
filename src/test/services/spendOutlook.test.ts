import { beforeEach, describe, expect, it } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';
import { outlookHeadline } from '@/lib/snakeOutlook';

/**
 * Driven against the real pool at the league actually being played, because the
 * whole value of this number is whether it is right about *this* board.
 */
describe('getSpendOutlook', () => {
  let service: AuctionDraftService;

  const hybrid = () =>
    leagueShape({
      teams: 12,
      budget: 100,
      rosterSize: 16,
      receptionPoints: 0.5,
      auctionSheetSize: 50,
      startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(hybrid());
    service.setMyTeam('team-1');
    service.setSnakeOrder(service.getTeams().map((t) => t.id));
  });

  it('refuses when the whole board is auctioned, because there is no snake', () => {
    localStorage.clear();
    const full = new AuctionDraftService(leagueShape({ auctionSheetSize: null }));
    full.setMyTeam('team-1');
    const out = full.getSpendOutlook();
    expect(out.positions).toBeNull();
    expect(out.reason).toMatch(/whole board/i);
  });

  it('refuses when no team is marked as yours', () => {
    localStorage.clear();
    const anon = new AuctionDraftService(hybrid());
    anon.setSnakeOrder(anon.getTeams().map((t) => t.id));
    const out = anon.getSpendOutlook();
    expect(out.positions).toBeNull();
    expect(out.reason).toMatch(/which team is yours/i);
  });

  it('reports every position with a free alternative and a gain', () => {
    const out = service.getSpendOutlook();
    expect(out.positions).not.toBeNull();
    expect(out.atOverall).toBeGreaterThan(0);
    for (const row of out.positions!) {
      expect(row.free).not.toBeNull();
      expect(Number.isFinite(row.gain)).toBe(true);
    }
  });

  it('finds the gain largest where the auction is deepest, not at kicker', () => {
    // The point of the whole exercise: a kicker the snake hands you is as good
    // as one you pay for, and a stud back is not.
    const rows = service.getSpendOutlook().positions!;
    const by = Object.fromEntries(rows.map((r) => [r.position, r]));
    expect(by.RB.gain).toBeGreaterThan(by.K.gain);
    expect(by.WR.gain).toBeGreaterThan(by.K.gain);
    expect(by.K.gain).toBeLessThan(30);
  });

  it('names what to spend on in one line', () => {
    const line = outlookHeadline(service.getSpendOutlook());
    expect(line).toMatch(/Money buys the most at/);
    expect(line).toMatch(/\+\d+/);
  });

  it('gets worse as your slot gets later, which is the whole mechanism', () => {
    const early = service.getSpendOutlook();
    localStorage.clear();
    const late = new AuctionDraftService(hybrid());
    late.setMyTeam('team-12');
    late.setSnakeOrder(late.getTeams().map((t) => t.id));
    const lateOut = late.getSpendOutlook();
    expect(lateOut.atOverall!).toBeGreaterThan(early.atOverall!);
    const rbEarly = early.positions!.find((r) => r.position === 'RB')!;
    const rbLate = lateOut.positions!.find((r) => r.position === 'RB')!;
    expect(rbLate.free!.points).toBeLessThanOrEqual(rbEarly.free!.points);
  });
});
