import { describe, it, expect } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';
import { readAuctionSheet, sheetPlayerIds } from '@/lib/auctionSheet';
/** The commissioner's real sixty. See `src/test/fixtures/README.md`. */
import SHEET from '../fixtures/auction-sheet.txt?raw';

/**
 * The night, end to end, at the league actually being played.
 *
 * The one claim this repo makes most often and had least behind it. Both
 * halves have been driven in a browser, and a browser drive is slow enough
 * that it happens once and then stops happening; the pieces were unit-tested
 * separately and the join was not. What this holds is the join: a sixty-name
 * sheet sold to exhaustion, the phase turning by itself when it empties, the
 * snake filling every remaining seat, the draft ending, and not one free pick
 * carrying a price.
 *
 * Driven at 12 x $100, half PPR with one flex, which is the league being
 * played rather than the pool's defaults.
 */
describe('the whole night', () => {
  it('sells the sheet, turns the phase, snakes the rest and ends', () => {
    localStorage.clear();
    const s = new AuctionDraftService(
      leagueShape({
        teams: 12,
        budget: 100,
        rosterSize: 16,
        receptionPoints: 0.5,
        startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1 },
      })
    );
    const cands = s
      .getPlayers()
      .map((p) => ({ id: p.id, name: p.name, position: p.position, team: p.team }));
    s.setAuctionSheet(sheetPlayerIds(readAuctionSheet(SHEET, cands).resolutions, {}));
    s.applyConsensusBoard();
    s.setMyTeam('team-1');
    s.setSnakeOrder(s.getTeams().map((t) => t.id));

    let sold = 0,
      unsold = 0,
      i = 0;
    for (let g = 0; g < 400 && s.getSheetRemaining().length; g++) {
      const target = s.getSheetRemaining()[0];
      let took = false;
      for (let t = 1; t <= 12; t++) {
        const price = Math.max(1, 12 - Math.floor(i / 6));
        if (s.validateBid(target.id, `team-${t}`, price).ok) {
          s.draftPlayer(target.id, `team-${t}`, price);
          took = true;
          sold++;
          break;
        }
      }
      if (!took) {
        s.removeFromSheet(target.id);
        unsold++;
      }
      i++;
    }
    console.log('auction: sold', sold, 'unsold', unsold, '| phase now', s.getPhase());
    expect(s.getPhase()).toBe('snake');

    let picks = 0;
    for (let g = 0; g < 400 && !s.isComplete(); g++) {
      const clock = s.getSnakeOnTheClock();
      if (!clock) break;
      let took = false;
      for (const p of s.getAvailablePlayers().slice(0, 60)) {
        if (s.validateSnakePick(p.id, clock.team.id).ok) {
          s.draftSnakePick(p.id, clock.team.id);
          took = true;
          picks++;
          break;
        }
      }
      if (!took) break;
    }
    console.log('snake picks:', picks, '| complete', s.isComplete());
    const hist = (s as unknown as { history: Array<{ phase?: string; cost?: number }> }).history;
    console.log(
      'log',
      hist.length,
      '| snake with a cost:',
      hist.filter((h) => h.phase === 'snake' && h.cost != null).length
    );
    console.log('endgame at the end:', s.getEndgame().verdict);
    expect(sold).toBe(60);
    expect(unsold).toBe(0);
    // Twelve teams of sixteen, and every seat filled by one half or the other.
    expect(s.isComplete()).toBe(true);
    expect(hist).toHaveLength(192);
    expect(picks).toBe(192 - 60);
    // The rule the whole snake half rests on: nobody paid for a free pick, and
    // no cost quietly became 0 on the way through.
    expect(hist.filter((h) => h.phase === 'snake' && h.cost != null)).toHaveLength(0);
  });
});
