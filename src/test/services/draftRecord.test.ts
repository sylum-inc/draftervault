import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';

/**
 * The record, corrected and kept.
 *
 * One person runs this app while eleven others draft on paper, which makes it
 * the only record of the night. Two things follow, and neither of them is about
 * bidding. A price called across a table gets misheard, and a name typed in a
 * hurry is the wrong one of two Robinsons — so the log has to be amendable in
 * the middle rather than only at the end. And the whole thing lives in one
 * browser profile with no server behind it, so how far it is from a copy the
 * owner actually holds is a number the room needs to be able to see.
 */

/** A sheet short enough to finish inside a test, but long enough to price. */
const smallSheet = (service: AuctionDraftService, count: number): string[] =>
  [...service.getPlayers()]
    .filter((player) => player.valueOverReplacement > 0)
    .sort((a, b) => b.modelValue - a.modelValue)
    .slice(0, count)
    .map((player) => player.id);

describe('correcting one pick in the middle of the draft', () => {
  let service: AuctionDraftService;
  let ids: string[];

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    ids = smallSheet(service, 40);
    service.setAuctionSheet(ids);
  });

  it('corrects a price, and only that price', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);
    service.draftPlayer(ids[2], 'team-1', 20);

    // $18 was called and $40 was written down.
    const result = service.correctPick(0, { cost: 18 });

    expect(result).toEqual({ ok: true, restored: 3, skipped: 0 });
    const teams = service.getTeams();
    expect(teams.find((team) => team.id === 'team-1')!.spent).toBe(38);
    expect(teams.find((team) => team.id === 'team-2')!.spent).toBe(30);
    expect(service.getPlayers().find((p) => p.id === ids[0])!.draftCost).toBe(18);
    // The rest of the log is untouched, including the order it happened in.
    expect(service.getHistory().map((pick) => pick.playerId)).toEqual([ids[0], ids[1], ids[2]]);
  });

  it('corrects the winning team, and moves the money with the player', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 25);

    expect(service.correctPick(0, { teamId: 'team-3' })).toEqual({
      ok: true,
      restored: 2,
      skipped: 0,
    });

    const teams = service.getTeams();
    expect(teams.find((team) => team.id === 'team-1')!.spent).toBe(0);
    expect(teams.find((team) => team.id === 'team-1')!.remaining).toBe(200);
    expect(teams.find((team) => team.id === 'team-3')!.spent).toBe(40);
    expect(service.getPlayers().find((p) => p.id === ids[0])!.draftedBy).toBe('team-3');
  });

  it('corrects the player, putting the wrong one back on the board', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 25);

    // The name called was the other Robinson.
    expect(service.correctPick(0, { playerId: ids[5] })).toEqual({
      ok: true,
      restored: 2,
      skipped: 0,
    });

    const players = service.getPlayers();
    expect(players.find((p) => p.id === ids[0])!.isDrafted).toBe(false);
    expect(players.find((p) => p.id === ids[0])!.draftCost).toBeUndefined();
    const bought = players.find((p) => p.id === ids[5])!;
    expect(bought.isDrafted).toBe(true);
    expect(bought.draftedBy).toBe('team-1');
    expect(bought.draftCost).toBe(40);
    // Corrected in place: the pick keeps its seat in the order of the night.
    expect(bought.pickNumber).toBe(1);
  });

  it('says how many later picks a correction costs, before it is applied', () => {
    service.draftPlayer(ids[0], 'team-1', 10);
    service.draftPlayer(ids[1], 'team-1', 20);
    service.draftPlayer(ids[2], 'team-2', 30);

    // $195 plus the $20 already committed is more than a $200 budget, so the
    // second pick by that team can no longer have happened.
    const preview = service.previewCorrection(0, { cost: 195 });

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.skipped).toBe(1);
    expect(preview.invalidated).toHaveLength(1);
    expect(preview.invalidated[0].pickNumber).toBe(2);
    expect(preview.invalidated[0].reason).toMatch(/only has \$\d+ left/);

    // Nothing has happened yet: a preview is a question, not a change.
    expect(service.getHistory()).toHaveLength(3);
    expect(service.getTeams().find((team) => team.id === 'team-1')!.spent).toBe(30);
  });

  it('applies exactly what the preview said it would', () => {
    service.draftPlayer(ids[0], 'team-1', 10);
    service.draftPlayer(ids[1], 'team-1', 20);
    service.draftPlayer(ids[2], 'team-2', 30);

    const preview = service.previewCorrection(0, { cost: 195 });
    const applied = service.correctPick(0, { cost: 195 });

    expect(preview.ok && applied.ok).toBe(true);
    if (!preview.ok || !applied.ok) return;
    expect(applied.restored).toBe(preview.restored);
    expect(applied.skipped).toBe(preview.skipped);
    // The pick that could not replay is gone from the log rather than sitting
    // in it as something illegal — counted, never dropped in silence.
    expect(service.getHistory()).toHaveLength(2);
    expect(service.getPlayers().find((p) => p.id === ids[1])!.isDrafted).toBe(false);
  });

  it('reports a player who would now be taken twice', () => {
    service.draftPlayer(ids[0], 'team-1', 10);
    service.draftPlayer(ids[1], 'team-2', 20);
    service.draftPlayer(ids[2], 'team-3', 30);

    const preview = service.previewCorrection(0, { playerId: ids[2] });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.invalidated).toHaveLength(1);
    expect(preview.invalidated[0].pickNumber).toBe(3);
    expect(preview.invalidated[0].reason).toMatch(/taken earlier/);

    expect(service.correctPick(0, { playerId: ids[2] })).toEqual({
      ok: true,
      restored: 2,
      skipped: 1,
    });
  });

  it('refuses a correction that would delete the pick it is correcting', () => {
    service.draftPlayer(ids[0], 'team-1', 40);

    // Above a whole budget: the engine would refuse the bid, so amending the
    // log to claim it happened would simply erase the sale.
    const result = service.correctPick(0, { cost: 260 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/only has \$200 left/);
    expect(service.getPlayers().find((p) => p.id === ids[0])!.draftCost).toBe(40);
  });

  it('refuses a $0 auction bid, exactly as a live bid is refused', () => {
    service.draftPlayer(ids[0], 'team-1', 40);

    expect(service.correctPick(0, { cost: 0 })).toEqual({
      ok: false,
      reason: 'A bid must be a whole dollar amount of $1 or more.',
    });
    expect(service.correctPick(0, { cost: 12.5 }).ok).toBe(false);
    expect(service.getPlayers().find((p) => p.id === ids[0])!.draftCost).toBe(40);
  });

  it('refuses an index that is not a pick', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    expect(service.correctPick(4, { cost: 10 }).ok).toBe(false);
    expect(service.correctPick(-1, { cost: 10 }).ok).toBe(false);
    expect(service.previewCorrection(4, { cost: 10 }).ok).toBe(false);
  });

  it('refuses a player or a team it does not know', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    expect(service.correctPick(0, { playerId: 'nobody' }).ok).toBe(false);
    expect(service.correctPick(0, { teamId: 'team-99' }).ok).toBe(false);
  });

  describe('across the boundary between the two halves', () => {
    /** Buy one sheet player and pass over the rest, which ends the auction. */
    const finishAuction = (buy: string, cost: number) => {
      for (const player of service.getSheetRemaining()) {
        if (player.id !== buy) service.removeFromSheet(player.id);
      }
      service.draftPlayer(buy, 'team-1', cost);
    };

    it('keeps every pick in the half it actually happened in', () => {
      finishAuction(ids[0], 30);
      expect(service.getPhase()).toBe('snake');
      const first = service.getSnakeOnTheClock()!;
      service.draftSnakePick(ids[20], first.team.id);
      const second = service.getSnakeOnTheClock()!;
      service.draftSnakePick(ids[21], second.team.id);

      const result = service.correctPick(0, { cost: 45 });

      expect(result).toEqual({ ok: true, restored: 3, skipped: 0 });
      expect(service.getHistory().map((pick) => pick.phase)).toEqual(['auction', 'snake', 'snake']);
      // The free picks stay free. Nothing about a correction to a sale is
      // allowed to put a price on a player nobody paid for.
      const players = service.getPlayers();
      expect(players.find((p) => p.id === ids[20])!.draftCost).toBeUndefined();
      expect(players.find((p) => p.id === ids[21])!.draftCost).toBeUndefined();
    });

    it('moves the phase back when the sale that ended the auction is corrected away', () => {
      finishAuction(ids[0], 30);
      const first = service.getSnakeOnTheClock()!;
      service.draftSnakePick(ids[20], first.team.id);

      // He was never on the sheet, so buying him instead leaves a sheet player
      // still to sell — and the auction the room thought was over is not.
      const offSheet = service.getPlayers().find((player) => !player.onSheet && !player.isDrafted)!;
      const result = service.correctPick(0, { playerId: offSheet.id });

      expect(result).toEqual({ ok: true, restored: 2, skipped: 0 });
      expect(service.getPhase()).toBe('auction');
      expect(service.getSheetRemaining().map((player) => player.id)).toEqual([ids[0]]);
      // The snake pick is still a snake pick. A logged pick is a record of what
      // happened, not a proposal to be re-adjudicated against a sheet that has
      // changed shape since.
      expect(service.getHistory()[1].phase).toBe('snake');
      expect(service.getPlayers().find((p) => p.id === ids[20])!.isDrafted).toBe(true);
    });

    it('refuses to put a price on a snake pick', () => {
      finishAuction(ids[0], 30);
      const first = service.getSnakeOnTheClock()!;
      service.draftSnakePick(ids[20], first.team.id);

      const result = service.correctPick(1, { cost: 12 });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/no price/);
      expect(service.getPlayers().find((p) => p.id === ids[20])!.draftCost).toBeUndefined();
    });

    it('corrects which player a free pick took, and he stays free', () => {
      finishAuction(ids[0], 30);
      const first = service.getSnakeOnTheClock()!;
      service.draftSnakePick(ids[20], first.team.id);

      expect(service.correctPick(1, { playerId: ids[25] }).ok).toBe(true);

      const players = service.getPlayers();
      expect(players.find((p) => p.id === ids[20])!.isDrafted).toBe(false);
      const taken = players.find((p) => p.id === ids[25])!;
      expect(taken.draftedBy).toBe(first.team.id);
      expect(taken.draftCost).toBeUndefined();
      // The seat that was consumed is the seat that was consumed: the wrong
      // name was written in it, not a different turn.
      expect(service.getHistory()[1].slot).toBe(first.slot);
    });
  });

  it('survives a reload, because the corrected log is the one that was stored', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 25);
    service.correctPick(0, { cost: 18, teamId: 'team-4' });

    // Constructed the way the app constructs it: the league comes back out of
    // storage, where the sheet import pinned it to the length of the list.
    const reloaded = new AuctionDraftService();
    reloaded.restore();

    const player = reloaded.getPlayers().find((p) => p.id === ids[0])!;
    expect(player.draftCost).toBe(18);
    expect(player.draftedBy).toBe('team-4');
  });
});

describe('an undo that can be undone', () => {
  let service: AuctionDraftService;
  let ids: string[];

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    ids = smallSheet(service, 40);
    service.setAuctionSheet(ids);
  });

  it('puts back one pick, with its price and its team', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.undoLastPick();
    expect(service.canRedo()).toBe(true);

    const back = service.redoLastUndo();

    expect(back?.ok).toBe(true);
    if (back?.ok) {
      expect(back.player.id).toBe(ids[0]);
      expect(back.cost).toBe(40);
    }
    const player = service.getPlayers().find((p) => p.id === ids[0])!;
    expect(player.draftedBy).toBe('team-1');
    expect(player.draftCost).toBe(40);
    expect(service.canRedo()).toBe(false);
  });

  it('puts back several, newest first, landing on the log it started from', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);
    service.draftPlayer(ids[2], 'team-3', 20);
    const before = [...service.getHistory()];

    service.undoLastPick();
    service.undoLastPick();
    service.undoLastPick();
    expect(service.undoneCount()).toBe(3);
    expect(service.getHistory()).toHaveLength(0);

    service.redoLastUndo();
    service.redoLastUndo();
    service.redoLastUndo();

    expect(service.getHistory()).toEqual(before);
    expect(service.canRedo()).toBe(false);
    expect(service.redoLastUndo()).toBeNull();
  });

  it('is cleared by drafting again, because that branch is history', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.undoLastPick();
    expect(service.canRedo()).toBe(true);

    service.draftPlayer(ids[1], 'team-2', 30);

    expect(service.canRedo()).toBe(false);
    expect(service.redoLastUndo()).toBeNull();
    expect(service.getHistory().map((pick) => pick.playerId)).toEqual([ids[1]]);
  });

  it('is cleared by a correction, a reset and a league change', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);

    service.undoLastPick();
    service.correctPick(0, { cost: 12 });
    expect(service.canRedo()).toBe(false);

    service.draftPlayer(ids[1], 'team-2', 30);
    service.undoLastPick();
    service.resetDraft();
    expect(service.canRedo()).toBe(false);
  });

  it('keeps a redone snake pick free, and in its own seat', () => {
    for (const player of service.getSheetRemaining()) {
      if (player.id !== ids[0]) service.removeFromSheet(player.id);
    }
    service.draftPlayer(ids[0], 'team-1', 30);
    const slot = service.getSnakeOnTheClock()!;
    service.draftSnakePick(ids[20], slot.team.id);

    const undone = service.undoLastPick();
    expect(undone?.cost).toBeNull();
    const back = service.redoLastUndo();

    expect(back?.ok).toBe(true);
    if (back?.ok) expect(back.cost).toBeNull();
    expect(service.getPlayers().find((p) => p.id === ids[20])!.draftCost).toBeUndefined();
    expect(service.getHistory()[1]).toEqual({
      playerId: ids[20],
      teamId: slot.team.id,
      phase: 'snake',
      slot: slot.slot,
    });
  });

  it('does not survive being told another window moved the draft', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.undoLastPick();
    expect(service.canRedo()).toBe(true);

    service.reloadFromStorage();

    // Redo is a private note about what this window's owner just did, never a
    // shared fact. A window that never pressed undo must not offer to redo.
    expect(service.canRedo()).toBe(false);
  });
});

describe('how exposed the record is', () => {
  let service: AuctionDraftService;
  let ids: string[];

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    ids = smallSheet(service, 40);
    service.setAuctionSheet(ids);
  });

  it('says nothing on an empty board', () => {
    expect(service.picksSinceExport()).toBe(0);
    expect(service.getExportMark()).toBeNull();
  });

  it('counts the whole draft while no copy of it has ever been made', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);
    expect(service.picksSinceExport()).toBe(2);
  });

  it('goes back to zero on a real save, and climbs again from there', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);

    const mark = service.markExported('file');

    expect(mark.kind).toBe('file');
    expect(mark.picks).toBe(2);
    expect(service.picksSinceExport()).toBe(0);

    service.draftPlayer(ids[2], 'team-3', 20);
    expect(service.picksSinceExport()).toBe(1);
  });

  it('counts an undo as movement, though the log got shorter', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);
    service.markExported('clipboard');

    service.undoLastPick();

    // The file on disk is no longer this draft. A count that subtracted its way
    // to zero here would call a stale copy current.
    expect(service.picksSinceExport()).toBe(1);
  });

  it('counts a correction as movement, though the log is the same length', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.markExported('file');
    expect(service.picksSinceExport()).toBe(0);

    service.correctPick(0, { cost: 18 });

    expect(service.picksSinceExport()).toBe(1);
  });

  it('remembers across a reload, because a refresh is not a backup', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.markExported('file');

    const reloaded = new AuctionDraftService();
    reloaded.restore();

    expect(reloaded.picksSinceExport()).toBe(0);
    expect(reloaded.getExportMark()?.kind).toBe('file');
  });

  it('treats a draft loaded from a file as one that exists in a file', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 30);
    const file = service.exportDraft();

    const other = new AuctionDraftService();
    const loaded = other.importDraft(file);

    expect(loaded.ok).toBe(true);
    expect(other.picksSinceExport()).toBe(0);
  });
});

describe('what the record must never quietly get wrong', () => {
  /**
   * Every one of these shipped as something the room stated confidently and
   * wrongly. On a night where this app is the only record, a reassurance that
   * is not true costs more than an obvious failure.
   */
  let service: AuctionDraftService;
  let ids: string[];

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    ids = smallSheet(service, 40);
    service.setAuctionSheet(ids);
  });

  it('does not call a fresh draft saved because an older, longer one was', () => {
    // The mark outlived the log it described, and picksSinceExport subtracted
    // its way to exactly 1 — the calm end of the scale — for a draft that had
    // never left the browser at all.
    for (let i = 0; i < 8; i++) service.draftPlayer(ids[i], `team-${(i % 12) + 1}`, 5);
    service.markExported('file');
    expect(service.picksSinceExport()).toBe(0);

    service.resetDraft();
    for (let i = 10; i < 14; i++) service.draftPlayer(ids[i], `team-${(i % 12) + 1}`, 5);

    expect(service.picksSinceExport()).toBe(4);
    expect(service.getExportMark()).toBeNull();
  });

  it('stamps the draft that actually left, not the one on the board after', () => {
    // A save is not instantaneous — the artifact's downloads capability puts a
    // confirmation in front of a person — so a pick made while it was in flight
    // used to be stamped as one that had gone out.
    service.draftPlayer(ids[0], 'team-1', 20);
    const snapshot = service.snapshotMark();

    service.draftPlayer(ids[1], 'team-2', 15);
    service.markExported('file', snapshot);

    expect(service.picksSinceExport()).toBe(1);
  });

  it('keeps the mark across a reload, which is not the same as a reset', () => {
    service.draftPlayer(ids[0], 'team-1', 20);
    service.markExported('file');

    const reloaded = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    reloaded.restore();

    expect(reloaded.picksSinceExport()).toBe(0);
  });

  it('refuses a correction that would delete its own pick, rather than offering it', () => {
    // The failure on the edited pick was being listed as collateral — "1 later
    // pick could no longer have happened", naming the pick being edited — under
    // an enabled button that the engine then always refused.
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 20);

    const preview = service.previewCorrection(0, { cost: 260 });
    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.reason).toMatch(/only has \$200 left/);
  });

  it('leaves a correction that drops picks undoable', () => {
    // The sharper of the two destructive acts had no net, while Reset — the
    // blunter, more obvious one — has had one since it destroyed an afternoon.
    service.draftPlayer(ids[0], 'team-1', 10);
    service.draftPlayer(ids[1], 'team-1', 20);
    service.draftPlayer(ids[2], 'team-2', 30);

    const applied = service.correctPick(0, { cost: 195 });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.skipped).toBe(1);
    expect(service.getHistory()).toHaveLength(2);

    // The pre-correction log is where a reset would have left it.
    const stashed = JSON.parse(localStorage.getItem('draft-vault:cleared-draft:v1') ?? '{}');
    expect(stashed.picks).toHaveLength(3);
  });

  it('reports a redo it could not make instead of swallowing the pick', () => {
    service.draftPlayer(ids[0], 'team-1', 60);
    service.undoLastPick();
    service.updateTeamBudget('team-1', 30);

    const outcome = service.redoLastUndo();
    expect(outcome?.ok).toBe(false);
    if (!outcome || outcome.ok) return;
    expect(outcome.reason).toMatch(/\$30|can no longer/);
  });

  it('counts a snake pick as free when rebuilding, not as a sheet purchase', () => {
    // sheetMask forces anyone already sold onto the sheet, so that a list
    // pasted mid-auction cannot re-price a player somebody paid for. Testing
    // "drafted" rather than "bought with money" swept free snake picks in too,
    // and a correction then produced a board the identical log does not replay
    // to.
    for (let i = 0; i < 40; i++) service.draftPlayer(ids[i], `team-${(i % 12) + 1}`, 2);
    expect(service.getPhase()).toBe('snake');

    const free = service.getAvailablePlayers().find((p) => !p.onSheet)!;
    const clock = service.getSnakeOnTheClock()!;
    expect(service.draftSnakePick(free.id, clock.team.id)).toBe(true);

    const before = JSON.stringify(service.getMarketState().scarcity);
    expect(service.correctPick(0, { cost: 3 }).ok).toBe(true);

    // Constructed the way a reload constructs it — off stored state — because
    // applying a sheet pins the auctioned count and a service handed the old
    // shape would rightly refuse to replay the draft at all.
    const replayed = new AuctionDraftService();
    expect(replayed.restore()).toBeGreaterThan(0);
    expect(JSON.stringify(replayed.getMarketState().scarcity)).toBe(
      JSON.stringify(service.getMarketState().scarcity)
    );
    expect(before).toBeTruthy();
  });
});

describe('the league nobody has confirmed', () => {
  /**
   * With nothing stored the board prices at the league the *pool* was built
   * for — full PPR, no flex — because that is what the source data scores. It
   * is a valid league and almost certainly not the one being played, and every
   * number on every card comes from it. Measured against the shipped pool, a
   * half-PPR league prices Ja'Marr Chase at $48 where full PPR says $53: about
   * 9% of a top receiver, on the position group an auction is mostly about, and
   * silently.
   */
  beforeEach(() => localStorage.clear());

  it('knows nobody has said what league this is', () => {
    expect(AuctionDraftService.hasStoredLeague()).toBe(false);
  });

  it('records a confirmation even when the defaults were already right', () => {
    // setLeagueShape returns early on a no-op, and rightly so — it clears the
    // draft. But that meant confirming the defaults exactly as they stand wrote
    // nothing, and the gate asked the same question on every load.
    const service = new AuctionDraftService();
    service.confirmLeague();

    expect(AuctionDraftService.hasStoredLeague()).toBe(true);
  });

  it('does not mistake "differs from the default" for "somebody looked at it"', () => {
    // writeStoredLeague removes its key when the shape matches the pool's,
    // since there is nothing to remember — so the league key cannot answer
    // whether the league was ever confirmed. Two questions, two keys.
    const service = new AuctionDraftService();
    service.confirmLeague();

    expect(localStorage.getItem('draft-vault:league:v1')).toBeNull();
    expect(AuctionDraftService.hasStoredLeague()).toBe(true);
  });

  it('prices a half-PPR league away from the full-PPR default', () => {
    const full = new AuctionDraftService(leagueShape({ receptionPoints: 1 }));
    const half = new AuctionDraftService(leagueShape({ receptionPoints: 0.5 }));

    const receiver = full
      .getPlayers()
      .filter((p) => p.position === 'WR')
      .sort((a, b) => b.estimatedValue - a.estimatedValue)[0];
    const sameUnderHalf = half.getPlayers().find((p) => p.id === receiver.id)!;

    // The top receiver is worth materially less when a catch is worth half.
    expect(sameUnderHalf.estimatedValue).toBeLessThan(receiver.estimatedValue);
  });
});
