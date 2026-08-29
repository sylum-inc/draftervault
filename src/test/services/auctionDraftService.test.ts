import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { leagueShape } from '@/lib/valuation';

const firstAvailable = (service: AuctionDraftService, position?: string) =>
  service.getAvailablePlayers().find((p) => !position || p.position === position)!;

describe('AuctionDraftService', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  describe('the seams the rest of the features hang off', () => {
    // These are the shared edges: several features need the same fact, and the
    // failure they are guarding against is two of them computing it separately
    // and disagreeing only on the night it matters.

    it('tells every listener, not just the last one to arrive', () => {
      // A second window follows the draft through a change listener already.
      // Anything else that wants to react to a pick — a save, a sync — used to
      // take the single slot and silently stop the first from ever firing.
      const heard: string[] = [];
      service.addChangeListener(() => heard.push('window'));
      service.addChangeListener(() => heard.push('autosave'));

      service.draftPlayer(firstAvailable(service).id, 'team-1', 5);

      expect(heard).toContain('window');
      expect(heard).toContain('autosave');
    });

    it('lets one listener leave without silencing the others', () => {
      const heard: string[] = [];
      const stop = service.addChangeListener(() => heard.push('going'));
      service.addChangeListener(() => heard.push('staying'));
      stop();

      service.draftPlayer(firstAvailable(service).id, 'team-1', 5);

      expect(heard).toEqual(['staying']);
    });

    it('keeps the single-listener form working for the caller that uses it', () => {
      let count = 0;
      service.setChangeListener(() => (count += 1));
      service.draftPlayer(firstAvailable(service).id, 'team-1', 5);
      expect(count).toBe(1);

      service.setChangeListener(null);
      service.draftPlayer(firstAvailable(service, 'WR').id, 'team-2', 5);
      expect(count).toBe(1);
    });

    it('accepts a bid at the ceiling and refuses the dollar above it', () => {
      // The money half of validateBid is now shared with whatever states a
      // team's ceiling. If the two ever drift, this boundary is where it shows
      // — a number displayed beside the bid box that the engine then rejects.
      const player = firstAvailable(service);
      expect(service.validateBid(player.id, 'team-1', 192).ok).toBe(true);
      expect(service.validateBid(player.id, 'team-1', 193).ok).toBe(false);
    });

    it('applies the roster rules to a free pick exactly as to a bid', () => {
      // checkRoster is split out so a pick that costs nothing still passes it.
      // A roster rule that stops a $1 bid but not an identical free pick is a
      // rule in name only.
      const limit = leagueShape().positionLimits.K;
      const kickers = service.getAvailablePlayers().filter((p) => p.position === 'K');
      for (let i = 0; i < limit; i++) {
        expect(service.draftPlayer(kickers[i].id, 'team-1', 1)).toBe(true);
      }

      const check = service.validateBid(kickers[limit].id, 'team-1', 1);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('position-full');
    });
  });

  describe('the reserve, in a partial auction', () => {
    // The $1-per-starting-slot reserve exists because every roster spot has to
    // be bought. This league auctions a commissioner's sheet of the best
    // players and fills the rest by snake draft, for free, with no minimum
    // number a team has to buy — so there is nothing to reserve for, and
    // holding money back caps bids the rules allow. It is the same mistake in
    // both directions: it shrinks our own ceiling, and it makes the room read
    // as poorer than it is, so an opponent looks tapped out while they can
    // still outbid us.
    const hybrid = () => {
      const service = new AuctionDraftService(leagueShape({ auctionSheetSize: 50 }));
      return service;
    };

    it('lets a team commit the whole budget when the snake fills the rest', () => {
      const service = hybrid();
      const player = firstAvailable(service);

      expect(service.validateBid(player.id, 'team-1', 200).ok).toBe(true);
      expect(service.draftPlayer(player.id, 'team-1', 200)).toBe(true);
      expect(service.getTeams()[0].remaining).toBe(0);
    });

    it('still refuses a dollar more than the budget', () => {
      const service = hybrid();
      const player = firstAvailable(service);
      const check = service.validateBid(player.id, 'team-1', 201);

      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('insufficient-funds');
    });

    it('keeps the reserve when the auction covers the whole roster', () => {
      // The rule is not deleted, it is made conditional. A full auction has to
      // go on holding a dollar for each starting slot it still has to buy.
      const service = new AuctionDraftService(leagueShape({ auctionSheetSize: null }));
      const player = firstAvailable(service);

      expect(service.validateBid(player.id, 'team-1', 200).ok).toBe(false);
      expect(service.validateBid(player.id, 'team-1', 192).ok).toBe(true);
    });

    it('reports the whole budget as spendable rather than holding some back', () => {
      const service = hybrid();
      const spend = service.simulateSpend('team-1', 200);

      expect(spend?.minimumHold).toBe(0);
      expect(spend?.legal).toBe(true);
      expect(spend?.remaining).toBe(0);
    });

    it('leaves a team with an empty roster and no money, which is legal here', () => {
      // Three players, the whole budget, thirteen spots to be snaked. The
      // engine must not treat that as a broken state.
      const service = hybrid();
      const players = service.getAvailablePlayers().slice(0, 3);

      expect(service.draftPlayer(players[0].id, 'team-1', 100)).toBe(true);
      expect(service.draftPlayer(players[1].id, 'team-1', 60)).toBe(true);
      expect(service.draftPlayer(players[2].id, 'team-1', 40)).toBe(true);

      const team = service.getTeams()[0];
      expect(team.remaining).toBe(0);
      // Still has roster room, so the draft is not over for them — the snake
      // is what fills it.
      expect(service.canDraft(team)).toBe(true);
    });
  });

  describe('bid validation', () => {
    it('rejects a NaN bid instead of poisoning the budget', () => {
      const player = firstAvailable(service);
      const check = service.validateBid(player.id, 'team-1', Number.NaN);

      expect(check.ok).toBe(false);
      expect(service.draftPlayer(player.id, 'team-1', Number.NaN)).toBe(false);
      expect(service.getTeams()[0].remaining).toBe(200);
    });

    it('rejects negative and zero bids', () => {
      const player = firstAvailable(service);

      expect(service.draftPlayer(player.id, 'team-1', -50)).toBe(false);
      expect(service.draftPlayer(player.id, 'team-1', 0)).toBe(false);
      expect(service.getTeams()[0].remaining).toBe(200);
    });

    it('rejects fractional bids', () => {
      const player = firstAvailable(service);
      expect(service.draftPlayer(player.id, 'team-1', 12.5)).toBe(false);
    });

    it('holds a dollar back for each unfilled starting slot', () => {
      const player = firstAvailable(service);
      const check = service.validateBid(player.id, 'team-1', 200);

      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('insufficient-funds');
      // Eight starters still to buy after this one, so $192 is the ceiling.
      expect(service.validateBid(player.id, 'team-1', 192)).toEqual({ ok: true });
    });

    it('will not let one team draft the same player twice', () => {
      const player = firstAvailable(service);
      expect(service.draftPlayer(player.id, 'team-1', 10)).toBe(true);

      const check = service.validateBid(player.id, 'team-2', 10);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('already-drafted');
    });

    it('enforces the per-position limit', () => {
      const quarterbacks = service
        .getAvailablePlayers()
        .filter((p) => p.position === 'QB')
        .slice(0, 4);
      expect(quarterbacks.length).toBe(4);

      quarterbacks
        .slice(0, 3)
        .forEach((qb) => expect(service.draftPlayer(qb.id, 'team-1', 1)).toBe(true));

      const check = service.validateBid(quarterbacks[3].id, 'team-1', 1);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('position-full');
    });
  });

  describe('roster accounting', () => {
    it('counts every draftable position, including K and DST', () => {
      const roster = service.getTeams()[0].roster;
      expect(Object.keys(roster).sort()).toEqual(['DST', 'K', 'QB', 'RB', 'TE', 'WR']);
    });

    it('keeps depth score finite as picks land', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 20);

      const team = service.getTeams()[0];
      expect(Number.isFinite(team.depthScore)).toBe(true);
      expect(team.spent).toBe(20);
      expect(team.remaining).toBe(180);
    });
  });

  describe('undo', () => {
    it('restores the player, the money and the roster slot', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 44);

      const undone = service.undoLastPick();
      expect(undone?.player.id).toBe(player.id);

      const team = service.getTeams()[0];
      expect(team.remaining).toBe(200);
      expect(team.roster[player.position]).toBe(0);
      expect(service.getAvailablePlayers().some((p) => p.id === player.id)).toBe(true);
      expect(service.canUndo()).toBe(false);
    });

    it('returns null when there is nothing to undo', () => {
      expect(service.undoLastPick()).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears derived team metrics, not just the picks', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 30);
      service.resetDraft();

      const team = service.getTeams()[0];
      expect(team.strengthScore).toBe(0);
      expect(team.riskScore).toBe(0);
      expect(team.depthScore).toBe(0);
      expect(team.injuryInsurance).toBe(0);
      expect(team.remaining).toBe(team.budget);
    });
  });

  describe('persistence', () => {
    it('replays a saved draft into a fresh service', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-3', 25);

      const resumed = new AuctionDraftService();
      expect(AuctionDraftService.hasSavedDraft()).toBe(true);
      expect(resumed.restore()).toBe(1);

      const drafted = resumed.getDraftedPlayers();
      expect(drafted).toHaveLength(1);
      expect(drafted[0].id).toBe(player.id);
      expect(drafted[0].draftedBy).toBe('team-3');
      expect(resumed.getTeams()[2].remaining).toBe(175);
    });

    it('reports nothing to restore on a clean slate', () => {
      expect(new AuctionDraftService().restore()).toBe(0);
    });
  });

  describe('budgets', () => {
    it('never sets a budget below what the team already spent', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 60);
      service.updateTeamBudget('team-1', 20);

      const team = service.getTeams()[0];
      expect(team.budget).toBe(60);
      expect(team.remaining).toBe(0);
    });
  });

  describe('change detection', () => {
    it('hands out a new array each read so consumers can diff references', () => {
      expect(service.getPlayers()).not.toBe(service.getPlayers());
      expect(service.getPlayers()).toHaveLength(service.getPlayers().length);
    });
  });

  describe('custom rankings', () => {
    it('starts with nothing imported', () => {
      expect(service.getCustomRankingCount()).toBe(0);
      expect(service.getPlayers().every((p) => p.customRanking === undefined)).toBe(true);
    });

    it('replaces the value everything downstream reads', () => {
      const player = firstAvailable(service);
      service.setCustomRankings({ [player.id]: { value: 77 } });

      const updated = service.getPlayers().find((p) => p.id === player.id)!;
      expect(updated.estimatedValue).toBe(77);
      // Advice has to follow the import, or an imported opinion is decoration.
      expect(updated.baseValue).toBe(77);
    });

    it('keeps our own number alongside theirs', () => {
      const player = firstAvailable(service);
      const ours = player.estimatedValue;
      service.setCustomRankings({ [player.id]: { value: ours + 40 } });

      const updated = service.getPlayers().find((p) => p.id === player.id)!;
      expect(updated.modelValue).toBe(ours);
      expect(updated.customRanking).toEqual({ value: ours + 40 });
    });

    it('leaves players the import did not mention alone', () => {
      const [first, second] = service.getAvailablePlayers();
      const untouched = second.estimatedValue;
      service.setCustomRankings({ [first.id]: { value: 5 } });

      expect(service.getPlayers().find((p) => p.id === second.id)!.estimatedValue).toBe(untouched);
    });

    it('overrides rank and tier as well as value', () => {
      const player = firstAvailable(service);
      service.setCustomRankings({ [player.id]: { rank: 300, tier: 4 } });

      const updated = service.getPlayers().find((p) => p.id === player.id)!;
      expect(updated.adp).toBe(300);
      expect(updated.tier).toBe(4);
    });

    it('does not disturb a draft already under way', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-2', 40);
      const other = service.getAvailablePlayers()[0];
      service.setCustomRankings({ [other.id]: { value: 60 } });

      // The money spent is still spent: an opinion about what is left cannot
      // reach back and change what a pick cost.
      const drafted = service.getDraftedPlayers();
      expect(drafted).toHaveLength(1);
      expect(drafted[0].id).toBe(player.id);
      expect(drafted[0].draftCost).toBe(40);
      expect(service.getTeams()[1].remaining).toBe(160);
    });

    it('goes back to our numbers when cleared', () => {
      const player = firstAvailable(service);
      const ours = player.estimatedValue;
      service.setCustomRankings({ [player.id]: { value: ours + 25 } });
      service.clearCustomRankings();

      const updated = service.getPlayers().find((p) => p.id === player.id)!;
      expect(updated.estimatedValue).toBe(ours);
      expect(updated.customRanking).toBeUndefined();
      expect(service.getCustomRankingCount()).toBe(0);
    });

    it('survives a reload', () => {
      const player = firstAvailable(service);
      service.setCustomRankings({ [player.id]: { value: 88 } });

      const reloaded = new AuctionDraftService();
      expect(reloaded.getPlayers().find((p) => p.id === player.id)!.estimatedValue).toBe(88);
    });
  });

  describe('a draft that runs out of room', () => {
    /** Fill a team to its roster limit at a dollar a head. */
    const fillTeam = (svc: AuctionDraftService, teamId: string) => {
      const league = svc.getLeagueShape();
      // Spread across positions so no position limit is hit first.
      for (const position of ['RB', 'WR', 'QB', 'TE', 'K', 'DST'] as const) {
        for (const player of svc.getAvailablePlayers().filter((p) => p.position === position)) {
          const team = svc.getTeams().find((t) => t.id === teamId)!;
          const filled = Object.values(team.roster).reduce((a, b) => a + b, 0);
          if (filled >= league.rosterSize) return;
          svc.draftPlayer(player.id, teamId, 1);
        }
      }
    };

    it('does not hand the nomination to a team that is full', () => {
      // team-1 is up first with nothing drafted.
      expect(service.getNominatingTeam()?.id).toBe('team-1');

      fillTeam(service, 'team-1');
      // Whoever is up now, it is not the team with no room left.
      expect(service.getNominatingTeam()?.id).not.toBe('team-1');
      expect(service.canDraft(service.getTeams()[0])).toBe(false);
    });

    it('knows when nobody can draft again', () => {
      expect(service.isComplete()).toBe(false);

      service.setLeagueShape(
        leagueShape({
          teams: 2,
          rosterSize: 1,
          startingLineup: { QB: 0, RB: 1, WR: 0, TE: 0, FLEX: 0, K: 0, DST: 0 },
        })
      );
      const [a, b] = service.getAvailablePlayers();
      service.draftPlayer(a.id, 'team-1', 1);
      expect(service.isComplete()).toBe(false);
      service.draftPlayer(b.id, 'team-2', 1);

      expect(service.isComplete()).toBe(true);
      expect(service.getNominatingTeam()).toBeUndefined();
    });
  });

  describe('taking back a reset', () => {
    it('offers back what the reset cleared', () => {
      const [a, b] = service.getAvailablePlayers();
      service.draftPlayer(a.id, 'team-1', 12);
      service.draftPlayer(b.id, 'team-2', 8);

      service.resetDraft();
      expect(service.getDraftedPlayers()).toHaveLength(0);
      expect(service.clearedPickCount()).toBe(2);

      expect(service.restoreClearedDraft()).toBe(2);
      const drafted = service.getDraftedPlayers();
      expect(drafted).toHaveLength(2);
      expect(drafted.find((p) => p.id === a.id)?.draftCost).toBe(12);
      expect(service.getTeams()[0].remaining).toBe(188);
    });

    it('offers nothing back when the draft was already empty', () => {
      service.resetDraft();
      expect(service.clearedPickCount()).toBe(0);
    });

    it('stops offering once somebody drafts again', () => {
      const [a, b] = service.getAvailablePlayers();
      service.draftPlayer(a.id, 'team-1', 12);
      service.resetDraft();
      expect(service.clearedPickCount()).toBe(1);

      // Restoring now would silently throw away the pick just made.
      service.draftPlayer(b.id, 'team-3', 5);
      expect(service.clearedPickCount()).toBe(0);
      expect(service.restoreClearedDraft()).toBe(0);
      expect(service.getDraftedPlayers()).toHaveLength(1);
    });

    it('will not put a draft back into a league that would not have charged those prices', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 30);
      service.resetDraft();

      service.setLeagueShape(leagueShape({ budget: 400 }));
      expect(service.clearedPickCount()).toBe(0);
      expect(service.restoreClearedDraft()).toBe(0);
    });

    it('does not offer the same cleared draft twice', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 12);
      service.resetDraft();
      service.restoreClearedDraft();
      service.resetDraft();

      // The second reset stashes the restored draft, not the original — but
      // restoring consumed the first stash, so this is a fresh one.
      expect(service.clearedPickCount()).toBe(1);
    });
  });

  describe('naming the teams', () => {
    it('starts with numbered defaults', () => {
      expect(service.getTeams()[6].name).toBe('Team 7');
      expect(service.getMyTeamId()).toBeNull();
    });

    it('renames a team without touching the draft', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-7', 25);

      service.renameTeam('team-7', 'Dave');
      expect(service.getTeams()[6].name).toBe('Dave');
      // A name is not a price: the draft is untouched.
      expect(service.getDraftedPlayers()).toHaveLength(1);
      expect(service.getTeams()[6].remaining).toBe(175);
    });

    it('falls back to the numbered default when a name is cleared', () => {
      service.renameTeam('team-3', 'Sarah');
      service.renameTeam('team-3', '   ');
      expect(service.getTeams()[2].name).toBe('Team 3');
    });

    it('remembers names and which team is mine across a reload', () => {
      service.renameTeam('team-2', 'Priya');
      service.setMyTeam('team-2');

      const reloaded = new AuctionDraftService();
      expect(reloaded.getTeams()[1].name).toBe('Priya');
      expect(reloaded.getMyTeamId()).toBe('team-2');
    });

    it('refuses a team that does not exist as mine', () => {
      service.setMyTeam('team-99');
      expect(service.getMyTeamId()).toBeNull();
    });

    it('keeps names through a league change', () => {
      service.renameTeam('team-1', 'Dave');
      service.setLeagueShape(leagueShape({ budget: 250 }));
      expect(service.getTeams()[0].name).toBe('Dave');
    });

    it('drops a name for a team the league no longer has', () => {
      service.renameTeam('team-12', 'Gone');
      service.setLeagueShape(leagueShape({ teams: 8 }));
      expect(service.getTeams()).toHaveLength(8);
      expect(service.getTeams().some((t) => t.name === 'Gone')).toBe(false);
    });

    it('announces a rename so another window follows it', () => {
      let announced = 0;
      service.setChangeListener(() => announced++);
      service.renameTeam('team-5', 'Marcus');
      expect(announced).toBeGreaterThan(0);
    });

    it('carries names into another window', () => {
      service.renameTeam('team-4', 'Nina');
      service.setMyTeam('team-4');

      const board = new AuctionDraftService();
      board.reloadFromStorage();
      expect(board.getTeams()[3].name).toBe('Nina');
      expect(board.getMyTeamId()).toBe('team-4');
    });

    it('carries names in the draft file', () => {
      service.renameTeam('team-1', 'Dave');
      service.setMyTeam('team-1');
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 20);
      const file = service.exportDraft();

      localStorage.clear();
      const elsewhere = new AuctionDraftService();
      expect(elsewhere.getTeams()[0].name).toBe('Team 1');

      elsewhere.importDraft(file);
      expect(elsewhere.getTeams()[0].name).toBe('Dave');
      expect(elsewhere.getMyTeamId()).toBe('team-1');
    });
  });

  describe('the draft as a file', () => {
    it('round-trips a draft through a file', () => {
      const [a, b] = service.getAvailablePlayers();
      service.draftPlayer(a.id, 'team-1', 30);
      service.draftPlayer(b.id, 'team-4', 12);
      const file = service.exportDraft();

      // A different machine: a fresh service that has never seen this draft.
      localStorage.clear();
      const elsewhere = new AuctionDraftService();
      expect(elsewhere.getDraftedPlayers()).toHaveLength(0);

      const result = elsewhere.importDraft(file);
      expect(result).toMatchObject({ ok: true, restored: 2, skipped: 0 });
      const drafted = elsewhere.getDraftedPlayers();
      expect(drafted.find((p) => p.id === a.id)?.draftCost).toBe(30);
      expect(elsewhere.getTeams()[3].remaining).toBe(188);
    });

    it('carries the league with the picks', () => {
      // Prices are meaningless without the league they were bid under.
      service.setLeagueShape(leagueShape({ teams: 10, budget: 300 }));
      const player = service.getAvailablePlayers()[0];
      service.draftPlayer(player.id, 'team-2', 40);
      const file = service.exportDraft();

      localStorage.clear();
      const elsewhere = new AuctionDraftService();
      expect(elsewhere.getTeams()).toHaveLength(12);

      expect(elsewhere.importDraft(file)).toMatchObject({ ok: true, restored: 1 });
      expect(elsewhere.getTeams()).toHaveLength(10);
      expect(elsewhere.getLeagueShape().budget).toBe(300);
    });

    it('replaces whatever was on the board', () => {
      const [a, b, c] = service.getAvailablePlayers();
      service.draftPlayer(a.id, 'team-1', 5);
      const file = service.exportDraft();

      service.resetDraft();
      service.draftPlayer(b.id, 'team-2', 7);
      service.draftPlayer(c.id, 'team-3', 9);
      expect(service.getDraftedPlayers()).toHaveLength(2);

      service.importDraft(file);
      const drafted = service.getDraftedPlayers();
      expect(drafted).toHaveLength(1);
      expect(drafted[0].id).toBe(a.id);
    });

    it('refuses a file that is not JSON', () => {
      expect(service.importDraft('not a draft at all')).toMatchObject({ ok: false });
    });

    it("refuses somebody else's JSON", () => {
      expect(service.importDraft('{"picks":[{"playerId":"x"}]}')).toMatchObject({
        ok: false,
        reason: expect.stringContaining('Draft Vault'),
      });
    });

    it('counts picks it could not replay rather than dropping them quietly', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 10);
      const file = JSON.parse(service.exportDraft());
      file.picks.push({ playerId: 'nobody-at-all', teamId: 'team-2', cost: 5 });

      expect(service.importDraft(JSON.stringify(file))).toMatchObject({
        ok: true,
        restored: 1,
        skipped: 1,
      });
    });

    it('survives an empty draft', () => {
      expect(service.importDraft(service.exportDraft())).toMatchObject({ ok: true, restored: 0 });
    });
  });

  describe('following another window', () => {
    /**
     * A second window is a second service over the same localStorage. These
     * exercise exactly that: one drafts, the other is told to reload.
     */
    const secondWindow = () => new AuctionDraftService();

    it('announces a pick to whoever is listening', () => {
      let announced = 0;
      service.setChangeListener(() => announced++);

      service.draftPlayer(firstAvailable(service).id, 'team-1', 10);
      expect(announced).toBeGreaterThan(0);
    });

    it('stops announcing once the listener is dropped', () => {
      let announced = 0;
      service.setChangeListener(() => announced++);
      service.setChangeListener(null);

      service.draftPlayer(firstAvailable(service).id, 'team-1', 10);
      expect(announced).toBe(0);
    });

    /**
     * The announcement is what actually drives a second window, and these are
     * the cases that shipped broken: `persist` returned early when the draft
     * emptied, so undo-to-zero, reset and a league change went unannounced —
     * every test above passed because it called `reloadFromStorage` itself.
     */
    it('announces an undo that empties the draft', () => {
      service.draftPlayer(firstAvailable(service).id, 'team-1', 10);

      let announced = 0;
      service.setChangeListener(() => announced++);
      service.undoLastPick();
      expect(announced).toBeGreaterThan(0);
    });

    it('announces a reset', () => {
      service.draftPlayer(firstAvailable(service).id, 'team-1', 10);

      let announced = 0;
      service.setChangeListener(() => announced++);
      service.resetDraft();
      expect(announced).toBeGreaterThan(0);
    });

    it('announces a league change', () => {
      let announced = 0;
      service.setChangeListener(() => announced++);
      service.setLeagueShape(leagueShape({ budget: 260 }));
      expect(announced).toBeGreaterThan(0);
    });

    it('announces an imported ranking, and its removal', () => {
      const player = firstAvailable(service);
      let announced = 0;
      service.setChangeListener(() => announced++);

      service.setCustomRankings({ [player.id]: { value: 40 } });
      expect(announced).toBeGreaterThan(0);

      announced = 0;
      service.clearCustomRankings();
      expect(announced).toBeGreaterThan(0);
    });

    it('picks up a pick another window made', () => {
      const board = secondWindow();
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-3', 25);

      expect(board.getDraftedPlayers()).toHaveLength(0);
      board.reloadFromStorage();

      const drafted = board.getDraftedPlayers();
      expect(drafted).toHaveLength(1);
      expect(drafted[0].id).toBe(player.id);
      expect(board.getTeams()[2].remaining).toBe(175);
    });

    it('picks up an undo', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 25);

      const board = secondWindow();
      board.reloadFromStorage();
      expect(board.getDraftedPlayers()).toHaveLength(1);

      service.undoLastPick();
      board.reloadFromStorage();
      expect(board.getDraftedPlayers()).toHaveLength(0);
      expect(board.getTeams()[0].remaining).toBe(200);
    });

    it('picks up a reset', () => {
      service.draftPlayer(firstAvailable(service).id, 'team-1', 25);
      const board = secondWindow();
      board.reloadFromStorage();

      service.resetDraft();
      board.reloadFromStorage();
      expect(board.getDraftedPlayers()).toHaveLength(0);
    });

    it('picks up a league change, re-priced', () => {
      const board = secondWindow();
      const before = board.getPlayers()[0].estimatedValue;

      service.setLeagueShape(leagueShape({ teams: 10, budget: 300 }));
      board.reloadFromStorage();

      expect(board.getTeams()).toHaveLength(10);
      expect(board.getLeagueShape().budget).toBe(300);
      expect(board.getPlayers()[0].estimatedValue).not.toBe(before);
    });

    it('picks up an imported ranking', () => {
      const player = firstAvailable(service);
      service.setCustomRankings({ [player.id]: { value: 91 } });

      const board = secondWindow();
      board.reloadFromStorage();
      expect(board.getPlayers().find((p) => p.id === player.id)!.estimatedValue).toBe(91);
    });

    it('does not announce while following, so two windows cannot loop', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 25);

      const board = secondWindow();
      let announced = 0;
      board.setChangeListener(() => announced++);
      board.reloadFromStorage();

      // Replaying writes to storage on every pick. If those counted as this
      // window's own changes, the two would rebuild each other forever.
      expect(announced).toBe(0);
      expect(board.getDraftedPlayers()).toHaveLength(1);
    });
  });

  describe('league configuration', () => {
    it('defaults to the league the shipped pool was priced for', () => {
      expect(service.getLeagueShape()).toEqual(service.getPoolLeagueShape());
      expect(service.getTeams()).toHaveLength(12);
      expect(service.getTeams()[0].budget).toBe(200);
    });

    it('rebuilds the room when the league changes', () => {
      expect(service.setLeagueShape(leagueShape({ teams: 10, budget: 300 }))).toBe(true);

      const teams = service.getTeams();
      expect(teams).toHaveLength(10);
      expect(teams.every((team) => team.budget === 300 && team.remaining === 300)).toBe(true);
    });

    it('re-prices the board rather than relabelling it', () => {
      const before = service.getPlayers().find((p) => p.position === 'RB')!;
      service.setLeagueShape(leagueShape({ budget: 400 }));
      const after = service.getPlayers().find((p) => p.id === before.id)!;

      // Twice the money chasing the same players has to reach the price tags.
      expect(after.estimatedValue).toBeGreaterThan(before.estimatedValue);
    });

    it('moves replacement level with the league', () => {
      const twelve = service.getReplacementLevel('WR')!;
      service.setLeagueShape(leagueShape({ teams: 8 }));

      // Eight teams roster fewer receivers, so the last one worth owning is
      // a better player.
      expect(service.getReplacementLevel('WR')!).toBeGreaterThan(twelve);
    });

    it('enforces the new roster limits', () => {
      service.setLeagueShape(
        leagueShape({
          rosterSize: 2,
          startingLineup: { QB: 0, RB: 0, WR: 1, TE: 0, FLEX: 0, K: 0, DST: 0 },
        })
      );
      const [a, b, c] = service.getAvailablePlayers().filter((p) => p.position === 'WR');

      expect(service.draftPlayer(a.id, 'team-1', 1)).toBe(true);
      expect(service.draftPlayer(b.id, 'team-1', 1)).toBe(true);
      expect(service.draftPlayer(c.id, 'team-1', 1)).toBe(false);
      expect(service.validateBid(c.id, 'team-1', 1)).toMatchObject({ code: 'roster-full' });
    });

    it('reports no change when the shape is the same', () => {
      expect(service.setLeagueShape(service.getLeagueShape())).toBe(false);
    });

    it('clears a draft in progress, whose bids were made at other prices', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 30);
      expect(service.getDraftedPlayers()).toHaveLength(1);

      service.setLeagueShape(leagueShape({ budget: 250 }));
      expect(service.getDraftedPlayers()).toHaveLength(0);
      expect(service.getTeams()[0].remaining).toBe(250);
    });

    it('remembers the league across a reload', () => {
      service.setLeagueShape(leagueShape({ teams: 14, budget: 260 }));

      const reloaded = new AuctionDraftService();
      expect(reloaded.getLeagueShape().teams).toBe(14);
      expect(reloaded.getTeams()).toHaveLength(14);
    });

    it('refuses to replay a draft bid in a different league', () => {
      const player = firstAvailable(service);
      service.draftPlayer(player.id, 'team-1', 30);

      // A pick log says nothing about the prices it was made at, so replaying it
      // under another league would build a roster nobody could have bought.
      const elsewhere = new AuctionDraftService(leagueShape({ budget: 500 }));
      expect(elsewhere.restore()).toBe(0);
    });

    it('keeps an import across a league change', () => {
      const player = firstAvailable(service);
      service.setCustomRankings({ [player.id]: { value: 99 } });
      service.setLeagueShape(leagueShape({ budget: 250 }));

      expect(service.getPlayers().find((p) => p.id === player.id)!.estimatedValue).toBe(99);
    });

    it('prices urgency for the lineup the league actually starts', () => {
      // Urgency is (unfilled slots x how much of the position is gone), so it is
      // zero for everyone before a draft starts. Take some quarterbacks off the
      // board first, and give team-1 one of its own.
      const runOnQbs = (svc: AuctionDraftService) => {
        const qbs = svc.getAvailablePlayers().filter((p) => p.position === 'QB');
        qbs.slice(0, 8).forEach((p, i) => svc.draftPlayer(p.id, `team-${(i % 5) + 2}`, 1));
        svc.draftPlayer(qbs[8].id, 'team-1', 1);
        return svc.getAvailablePlayers().find((p) => p.position === 'QB')!;
      };

      const standardQb = runOnQbs(service);
      const standard = service.getPlayerAnalytics(standardQb.id, 'team-1').needMultiplier;

      // A superflex league starts two quarterbacks, so team-1 still has a hole
      // where the standard league says it is done at the position.
      const superflexService = new AuctionDraftService(
        leagueShape({ startingLineup: { QB: 2, RB: 2, WR: 2, TE: 1, FLEX: 0, K: 1, DST: 1 } })
      );
      const superflexQb = runOnQbs(superflexService);
      const superflex = superflexService.getPlayerAnalytics(
        superflexQb.id,
        'team-1'
      ).needMultiplier;

      expect(standard).toBe(1);
      expect(superflex).toBeGreaterThan(1);
    });

    it('holds back a dollar for every slot the lineup starts', () => {
      // Eleven starting slots means ten dollars are spoken for after this bid,
      // so a $200 team cannot spend more than $190 on its first player.
      service.setLeagueShape(
        leagueShape({
          startingLineup: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2, K: 1, DST: 1 },
        })
      );
      const player = firstAvailable(service);

      expect(service.validateBid(player.id, 'team-1', 191).ok).toBe(false);
      expect(service.validateBid(player.id, 'team-1', 190).ok).toBe(true);
    });

    it('counts a third receiver as a starter, not as bench depth', () => {
      // depthScore read its own QB1/RB2/WR2 table while urgency read
      // QB1/RB2/WR3, so a third receiver was both at once.
      const wrs = service
        .getAvailablePlayers()
        .filter((p) => p.position === 'WR')
        .slice(0, 3);
      wrs.forEach((player) => service.draftPlayer(player.id, 'team-1', 1));

      expect(service.getTeams()[0].depthScore).toBe(0);
    });

    it('clamps a league nobody could draft in', () => {
      service.setLeagueShape(leagueShape({ teams: 1, budget: 0, rosterSize: 0 }));
      const league = service.getLeagueShape();

      expect(league.teams).toBeGreaterThanOrEqual(2);
      expect(league.budget).toBeGreaterThanOrEqual(10);
      expect(league.rosterSize).toBeGreaterThanOrEqual(1);
      expect(service.getPlayers().every((p) => Number.isInteger(p.estimatedValue))).toBe(true);
    });
  });
});
