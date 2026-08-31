import { beforeEach, describe, expect, it } from 'vitest';
import { readAuctionSheet, sheetPlayerIds } from '@/lib/auctionSheet';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';
/** The commissioner's real sixty. See `src/test/fixtures/README.md`. */
import SHEET from '../fixtures/auction-sheet.txt?raw';

/**
 * What a player adds to *your* lineup, which is not what he adds to a lineup in
 * the abstract.
 *
 * The mistake this exists to stop is the one that loses a hybrid draft: your
 * two running back slots fill, and the board keeps quoting the gap to the best
 * free back for every back after that — a seat that is already taken. The
 * third back is competing for your flex, against every position that can fill
 * it, and the fourth is a bench body who adds nothing that scores.
 */
describe('gain against your own roster', () => {
  let service: AuctionDraftService;

  const league = () =>
    leagueShape({
      teams: 12,
      budget: 100,
      rosterSize: 16,
      receptionPoints: 0.5,
      startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1 },
    });

  const backs = () =>
    service
      .getPlayers()
      .filter((p) => p.onSheet && !p.isDrafted && p.position === 'RB')
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

  const buy = (id: string) => expect(service.draftPlayer(id, 'team-6', 1)).toBe(true);

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(league());
    const cands = service
      .getPlayers()
      .map((p) => ({ id: p.id, name: p.name, position: p.position, team: p.team }));
    const parsed = readAuctionSheet(SHEET, cands);
    service.setAuctionSheet(sheetPlayerIds(parsed.resolutions, {}));
    service.applyConsensusBoard();
    service.setMyTeam('team-6');
    service.setSnakeOrder(service.getTeams().map((t) => t.id));
  });

  it('calls the first two backs starters, against the free back', () => {
    const rb = backs();
    expect(service.gainOverSnake(rb[0].id)?.slot).toBe('starter');
    buy(rb[0].id);
    expect(service.gainOverSnake(rb[1].id)?.slot).toBe('starter');
  });

  it('drops a third back to the flex, where the bar is higher', () => {
    const rb = backs();
    const before = service.gainOverSnake(rb[2].id)!;
    buy(rb[0].id);
    buy(rb[1].id);
    const after = service.gainOverSnake(rb[2].id)!;
    expect(before.slot).toBe('starter');
    expect(after.slot).toBe('flex');
    // The flex is contested by every eligible position, so the free man he has
    // to beat is at least as good — never worse — and the gain never rises.
    expect(after.freePoints!).toBeGreaterThanOrEqual(before.freePoints!);
    expect(after.gain).toBeLessThanOrEqual(before.gain);
  });

  it('calls a fourth back a bench player worth nothing to the lineup', () => {
    const rb = backs();
    buy(rb[0].id);
    buy(rb[1].id);
    buy(rb[2].id);
    const fourth = service.gainOverSnake(rb[3].id)!;
    expect(fourth.slot).toBe('bench');
    expect(fourth.gain).toBe(0);
    // No man is quoted, because there is no seat he takes from anybody.
    expect(fourth.free).toBeNull();
    expect(fourth.note).toMatch(/bench player/i);
  });

  it('still values a receiver while the receiver slots are open', () => {
    const rb = backs();
    buy(rb[0].id);
    buy(rb[1].id);
    buy(rb[2].id);
    const wr = service
      .getPlayers()
      .filter((p) => p.onSheet && !p.isDrafted && p.position === 'WR')
      .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
    const out = service.gainOverSnake(wr.id)!;
    expect(out.slot).toBe('starter');
    expect(out.gain).toBeGreaterThan(0);
  });

  it('refuses when no team is marked, rather than answering for somebody else', () => {
    localStorage.clear();
    const anon = new AuctionDraftService(league());
    anon.setSnakeOrder(anon.getTeams().map((t) => t.id));
    const any = anon.getPlayers()[0];
    expect(anon.gainOverSnake(any.id)).toBeNull();
  });
});
