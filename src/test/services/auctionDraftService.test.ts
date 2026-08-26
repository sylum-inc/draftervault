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
