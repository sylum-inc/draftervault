import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';

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
});
