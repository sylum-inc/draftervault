import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { adviseOnBid, adviseOnNomination, adviseOnSnakePick } from '@/services/draftAdvisor';
import { leagueShape } from '@/lib/valuation';

/**
 * The hybrid format: the commissioner circulates a sheet of the best 50-100
 * players, those are auctioned, and every remaining roster spot is filled by a
 * serpentine snake draft. Roughly sixty picks bought with money and a hundred
 * and forty taken for nothing.
 *
 * Almost everything below is guarding one boundary: money counts the auction,
 * supply counts both halves. A free pick that leaks into a money figure is
 * indistinguishable from a player bought for $0, and there is no way to tell
 * the difference back out again once it has.
 */

/** A small sheet, so the auction can be finished inside a test. */
const smallSheet = (service: AuctionDraftService, count: number): string[] =>
  [...service.getPlayers()]
    .filter((player) => player.valueOverReplacement > 0)
    .sort((a, b) => b.modelValue - a.modelValue)
    .slice(0, count)
    .map((player) => player.id);

/** Buy or pass over every player on the sheet, which is what ends the auction. */
const finishAuction = (service: AuctionDraftService): void => {
  for (const player of service.getSheetRemaining()) service.removeFromSheet(player.id);
};

describe('the snake half of a hybrid draft', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 50 }));
  });

  describe('the phase is derived, never stored', () => {
    it('stays in the auction while any sheet player is still to be settled', () => {
      service.setAuctionSheet(smallSheet(service, 20));
      expect(service.getPhase()).toBe('auction');

      const sheet = service.getSheetRemaining();
      for (const player of sheet.slice(0, sheet.length - 1)) service.removeFromSheet(player.id);

      // One player nobody has called is enough. This is the whole reason the
      // unsold control has to exist: without it that last name holds the room
      // in an auction the table left twenty minutes ago.
      expect(service.getSheetRemaining()).toHaveLength(1);
      expect(service.getPhase()).toBe('auction');
    });

    it('turns to the snake when every sheet player is sold or passed over', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      service.draftPlayer(ids[0], 'team-1', 40);
      finishAuction(service);

      expect(service.getPhase()).toBe('snake');
    });

    it('has no snake phase at all without a sheet in force', () => {
      // A size typed into the settings panel says how many players are bought,
      // not which — so the room cannot know when the money is finished, and
      // guessing would take the bid box away with names still to call.
      const sized = new AuctionDraftService(leagueShape({ auctionSheetSize: 50 }));
      expect(sized.getSheetCount()).toBe(0);
      expect(sized.getPhase()).toBe('auction');

      const whole = new AuctionDraftService(leagueShape({ auctionSheetSize: null }));
      expect(whole.getPhase()).toBe('auction');
    });

    it('lands on the same phase after a reload, because both replay one log', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      service.draftPlayer(ids[0], 'team-1', 40);
      finishAuction(service);
      const onTheClock = service.getSnakeOnTheClock()!;
      service.draftSnakePick(service.getAvailablePlayers()[0].id, onTheClock.team.id);

      const reloaded = new AuctionDraftService();
      reloaded.restore();

      expect(reloaded.getPhase()).toBe('snake');
      expect(reloaded.getSnakePickCount()).toBe(1);
    });

    it('follows another window across the boundary', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      finishAuction(service);

      const second = new AuctionDraftService();
      second.reloadFromStorage();
      expect(second.getPhase()).toBe('snake');
    });
  });

  describe('a snake pick has no cost', () => {
    const intoSnake = () => {
      service.setAuctionSheet(smallSheet(service, 20));
      finishAuction(service);
      return service.getSnakeOnTheClock()!;
    };

    it('leaves draftCost undefined rather than zero', () => {
      const slot = intoSnake();
      const player = service.getAvailablePlayers()[0];

      expect(service.draftSnakePick(player.id, slot.team.id)).toBe(true);

      const taken = service.getPlayers().find((p) => p.id === player.id)!;
      expect(taken.isDrafted).toBe(true);
      expect(taken.draftedBy).toBe(slot.team.id);
      // Zero would read as "bought for nothing", which is a claim about money
      // that nobody made. It poisons premium, surplus, inflation and grades.
      expect(taken.draftCost).toBeUndefined();
      expect(taken.draftCost).not.toBe(0);
    });

    it('moves no money at all', () => {
      const slot = intoSnake();
      const before = service.getTeams().find((t) => t.id === slot.team.id)!;
      service.draftSnakePick(service.getAvailablePlayers()[0].id, slot.team.id);

      const after = service.getTeams().find((t) => t.id === slot.team.id)!;
      expect(after.spent).toBe(before.spent);
      expect(after.remaining).toBe(before.remaining);
    });

    it('still refuses a $0 auction bid', () => {
      // The free pick is its own call. A zero-dollar bid stays exactly as
      // illegal as it was, or the two become the same transaction.
      const player = service.getAvailablePlayers()[0];
      const check = service.validateBid(player.id, 'team-1', 0);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('invalid-amount');
      expect(service.draftPlayer(player.id, 'team-1', 0)).toBe(false);
    });

    it('reports no cost on the board rather than zero', () => {
      const slot = intoSnake();
      const player = service.getAvailablePlayers()[0];
      service.draftSnakePick(player.id, slot.team.id);

      const row = service.getDraftBoard().find((entry) => entry.team.id === slot.team.id)!;
      const pick = row.picks.find((entry) => entry.player.id === player.id)!;
      expect(pick.cost).toBeNull();
      expect(pick.phase).toBe('snake');
    });
  });

  describe('money counts the auction; supply counts both', () => {
    it('leaves premium and inflation untouched while moving scarcity', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      // Two sales at one position, so there is a premium to read at all.
      const sold = service.getPlayers().filter((p) => ids.includes(p.id) && p.position === 'WR');
      service.draftPlayer(sold[0].id, 'team-1', 30);
      service.draftPlayer(sold[1].id, 'team-2', 20);
      finishAuction(service);

      const before = service.getMarketState();
      // A player the room passed over is still on the sheet and still priced,
      // so taking him in the snake is the case where supply and money could
      // most easily be confused for each other.
      const free = service
        .getAvailablePlayers()
        .find((p) => p.onSheet && p.position === 'WR' && p.estimatedValue > 1)!;
      const slot = service.getSnakeOnTheClock()!;
      expect(service.draftSnakePick(free.id, slot.team.id)).toBe(true);

      const after = service.getMarketState();
      expect(after.premium).toBe(before.premium);
      expect(after.inflation).toBe(before.inflation);

      const position = (state: typeof before) =>
        state.scarcity.find((row) => row.position === 'WR')!;
      // He is genuinely off the board — waiting for him is no longer an option.
      expect(position(after).gone).toBe(position(before).gone + 1);
      // But nobody bought him, so the count of what the room paid for is unmoved.
      expect(position(after).sold).toBe(position(before).sold);
    });

    it('freezes inflation for the whole snake phase', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      service.draftPlayer(ids[0], 'team-1', 60);
      finishAuction(service);

      expect(service.getMarketState().inflation).toBe(1);

      // Money left is fixed while value left goes on shrinking, so without the
      // short-circuit this climbs on its own until it pins at the 1.8 clamp and
      // the market panel reads "expect overpays" for a hundred and forty picks
      // in which nobody spends a penny.
      for (let i = 0; i < 6; i++) {
        const slot = service.getSnakeOnTheClock()!;
        service.draftSnakePick(service.getAvailablePlayers()[0].id, slot.team.id);
      }
      expect(service.getMarketState().inflation).toBe(1);
    });
  });

  describe('whose turn it is', () => {
    const intoSnake = (teams = 12) => {
      localStorage.clear();
      const svc = new AuctionDraftService(leagueShape({ teams, auctionSheetSize: 50 }));
      svc.setAuctionSheet(smallSheet(svc, 20));
      finishAuction(svc);
      return svc;
    };

    it('runs the first round down the order and the second back up it', () => {
      const svc = intoSnake();
      const order = svc.getSnakeOrder();
      const seen: string[] = [];

      for (let i = 0; i < order.length * 2; i++) {
        const slot = svc.getSnakeOnTheClock()!;
        seen.push(slot.team.id);
        svc.draftSnakePick(svc.getAvailablePlayers()[0].id, slot.team.id);
      }

      const ids = order.map((team) => team.id);
      expect(seen).toEqual([...ids, ...[...ids].reverse()]);
    });

    it('numbers the round and the pick', () => {
      const svc = intoSnake();
      expect(svc.getSnakeOnTheClock()).toMatchObject({ round: 1, pick: 1, overall: 1 });

      const order = svc.getSnakeOrder();
      for (let i = 0; i < order.length; i++) {
        const slot = svc.getSnakeOnTheClock()!;
        svc.draftSnakePick(svc.getAvailablePlayers()[0].id, slot.team.id);
      }
      expect(svc.getSnakeOnTheClock()).toMatchObject({ round: 2, pick: 1 });
      // Round two runs backwards, so its first seat is the last team.
      expect(svc.getSnakeOnTheClock()!.team.id).toBe(order[order.length - 1].id);
    });

    it('steps over a team whose roster is already full', () => {
      // This format has no minimum anybody must buy at auction, so rosters fill
      // at wildly different times: one manager can spend $200 on three players
      // and another can buy fourteen at a dollar.
      localStorage.clear();
      const svc = new AuctionDraftService(
        leagueShape({ teams: 4, rosterSize: 2, auctionSheetSize: 50 })
      );
      const ids = smallSheet(svc, 20);
      svc.setAuctionSheet(ids);
      const bought = svc.getPlayers().filter((p) => ids.includes(p.id));
      svc.draftPlayer(bought[0].id, 'team-1', 10);
      svc.draftPlayer(bought[1].id, 'team-1', 10);
      finishAuction(svc);

      // team-1 is the first seat of the order and has no room, so the clock
      // has to hand the pick to the second seat rather than to a full roster.
      expect(svc.canDraft(svc.getTeams().find((t) => t.id === 'team-1')!)).toBe(false);
      expect(svc.getSnakeOrder()[0].id).toBe('team-1');
      expect(svc.getSnakeOnTheClock()!.team.id).toBe('team-2');
    });

    it('never hands the same team two picks in a row over a skipped one', () => {
      // The obvious implementation indexes straight into the serpentine slot
      // number, and skipping a full team then shifts every later slot: the team
      // after the full one is asked twice and the one after that never.
      localStorage.clear();
      const svc = new AuctionDraftService(
        leagueShape({ teams: 4, rosterSize: 3, auctionSheetSize: 50 })
      );
      const ids = smallSheet(svc, 20);
      svc.setAuctionSheet(ids);
      const bought = svc.getPlayers().filter((p) => ids.includes(p.id));
      for (let i = 0; i < 3; i++) svc.draftPlayer(bought[i].id, 'team-2', 5);
      finishAuction(svc);

      const seen: string[] = [];
      for (let i = 0; i < 3; i++) {
        const slot = svc.getSnakeOnTheClock()!;
        seen.push(slot.team.id);
        svc.draftSnakePick(svc.getAvailablePlayers()[0].id, slot.team.id);
      }
      expect(seen).toEqual(['team-1', 'team-3', 'team-4']);
    });

    it('has nobody on the clock once every roster is full', () => {
      localStorage.clear();
      const svc = new AuctionDraftService(
        leagueShape({ teams: 2, rosterSize: 1, auctionSheetSize: 50 })
      );
      const ids = smallSheet(svc, 20);
      svc.setAuctionSheet(ids);
      finishAuction(svc);

      svc.draftSnakePick(svc.getAvailablePlayers()[0].id, svc.getSnakeOnTheClock()!.team.id);
      svc.draftSnakePick(svc.getAvailablePlayers()[0].id, svc.getSnakeOnTheClock()!.team.id);

      expect(svc.getSnakeOnTheClock()).toBeUndefined();
      expect(svc.isComplete()).toBe(true);
    });
  });

  describe('the order the commissioner fixed', () => {
    it('defaults to the team order', () => {
      expect(service.getSnakeOrder().map((team) => team.id)).toEqual(
        service.getTeams().map((team) => team.id)
      );
    });

    it('can be set and remembered', () => {
      const reversed = service
        .getTeams()
        .map((team) => team.id)
        .reverse();
      service.setSnakeOrder(reversed);

      expect(service.getSnakeOrder().map((team) => team.id)).toEqual(reversed);
      expect(new AuctionDraftService().getSnakeOrder().map((team) => team.id)).toEqual(reversed);
    });

    it('does not throw the draft away, unlike a league change', () => {
      // This is exactly the precedent team names set: `sameLeague` decides
      // whether a draft survives, so anything that must not clear the board
      // has to live outside `LeagueShape`.
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      service.draftPlayer(ids[0], 'team-1', 40);

      service.setSnakeOrder(
        service
          .getTeams()
          .map((team) => team.id)
          .reverse()
      );

      expect(service.getDraftedPlayers()).toHaveLength(1);
      expect(service.getTeams()[0].remaining).toBe(160);
    });

    it('can be reordered mid-snake, moving only who is next', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      finishAuction(service);
      const first = service.getSnakeOnTheClock()!.team.id;
      service.draftSnakePick(service.getAvailablePlayers()[0].id, first);

      const reversed = service
        .getTeams()
        .map((team) => team.id)
        .reverse();
      service.setSnakeOrder(reversed);

      expect(service.getSnakePickCount()).toBe(1);
      // One pick has been assigned, so the second seat of the new order is up.
      expect(service.getSnakeOnTheClock()!.team.id).toBe(reversed[1]);
    });

    it('repairs an order that has lost a team rather than dropping it', () => {
      service.setSnakeOrder(['team-3', 'team-1']);
      const order = service.getSnakeOrder().map((team) => team.id);
      expect(order.slice(0, 2)).toEqual(['team-3', 'team-1']);
      expect(order).toHaveLength(service.getTeams().length);
      expect(new Set(order).size).toBe(order.length);
    });
  });

  describe('validating a free pick', () => {
    const intoSnake = () => {
      service.setAuctionSheet(smallSheet(service, 20));
      finishAuction(service);
      return service.getSnakeOnTheClock()!;
    };

    it('refuses a pick while the auction is still running', () => {
      service.setAuctionSheet(smallSheet(service, 20));
      const check = service.validateSnakePick(service.getAvailablePlayers()[0].id, 'team-1');
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('not-in-snake');
      expect(service.draftSnakePick(service.getAvailablePlayers()[0].id, 'team-1')).toBe(false);
    });

    it('refuses a team that is not on the clock', () => {
      const slot = intoSnake();
      const other = service.getTeams().find((team) => team.id !== slot.team.id)!;
      const check = service.validateSnakePick(service.getAvailablePlayers()[0].id, other.id);

      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('not-your-turn');
    });

    it('applies the roster and position limits, exactly as a bid does', () => {
      // checkRoster was split out of validateBid for this: a roster rule that
      // stops a $1 bid but not an identical free pick is a rule in name only.
      localStorage.clear();
      const svc = new AuctionDraftService(
        leagueShape({ teams: 2, rosterSize: 16, auctionSheetSize: 50 })
      );
      svc.setAuctionSheet(smallSheet(svc, 20));
      finishAuction(svc);

      const limit = svc.getLeagueShape().positionLimits.K;
      for (let i = 0; i < limit; i++) {
        const slot = svc.getSnakeOnTheClock()!;
        const kicker = svc.getAvailablePlayers().find((p) => p.position === 'K')!;
        // Give the same team every kicker by handing the other team a filler.
        if (slot.team.id !== 'team-1') {
          svc.draftSnakePick(
            svc.getAvailablePlayers().find((p) => p.position === 'WR')!.id,
            slot.team.id
          );
          i--;
          continue;
        }
        expect(svc.draftSnakePick(kicker.id, 'team-1')).toBe(true);
      }

      let attempts = 0;
      while (svc.getSnakeOnTheClock()!.team.id !== 'team-1' && attempts++ < 8) {
        const slot = svc.getSnakeOnTheClock()!;
        svc.draftSnakePick(
          svc.getAvailablePlayers().find((p) => p.position === 'WR')!.id,
          slot.team.id
        );
      }
      const extra = svc.getAvailablePlayers().find((p) => p.position === 'K')!;
      const check = svc.validateSnakePick(extra.id, 'team-1');
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('position-full');
    });

    it('refuses a player somebody already has', () => {
      const slot = intoSnake();
      const player = service.getAvailablePlayers()[0];
      service.draftSnakePick(player.id, slot.team.id);

      const check = service.validateSnakePick(player.id, service.getSnakeOnTheClock()!.team.id);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.code).toBe('already-drafted');
    });
  });

  describe('undo crosses the boundary', () => {
    it('stays in the snake when a snake pick is taken back, because the sheet is still empty', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      finishAuction(service);
      expect(service.getPhase()).toBe('snake');

      const slot = service.getSnakeOnTheClock()!;
      const player = service.getAvailablePlayers()[0];
      service.draftSnakePick(player.id, slot.team.id);

      const undone = service.undoLastPick();
      expect(undone?.player.id).toBe(player.id);
      // No money moved, so there is none to hand back — and null rather than 0
      // for the same reason `draftCost` is absent rather than zero.
      expect(undone?.cost).toBeNull();

      // The phase comes back for free, because it derives from the log and the
      // log is one entry shorter. Nothing had to be told the phase changed.
      expect(service.getPhase()).toBe('snake');
      expect(service.getSnakePickCount()).toBe(0);
      expect(service.getTeams().find((t) => t.id === slot.team.id)!.remaining).toBe(200);
    });

    it('returns to the auction when an unsold player is put back up', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      finishAuction(service);
      expect(service.getPhase()).toBe('snake');

      expect(service.returnToSheet(ids[0])).toBe(true);
      expect(service.getPhase()).toBe('auction');
    });
  });

  describe('the file and the second window', () => {
    it('carries each pick’s phase and the snake order', () => {
      const ids = smallSheet(service, 20);
      service.setAuctionSheet(ids);
      const reversed = service
        .getTeams()
        .map((team) => team.id)
        .reverse();
      service.setSnakeOrder(reversed);
      service.draftPlayer(ids[0], 'team-1', 40);
      finishAuction(service);
      const slot = service.getSnakeOnTheClock()!;
      const free = service.getAvailablePlayers()[0];
      service.draftSnakePick(free.id, slot.team.id);

      const file = service.exportDraft();
      localStorage.clear();
      const elsewhere = new AuctionDraftService();
      expect(elsewhere.importDraft(file)).toMatchObject({ ok: true, restored: 2, skipped: 0 });

      expect(elsewhere.getPhase()).toBe('snake');
      expect(elsewhere.getSnakeOrder().map((team) => team.id)).toEqual(reversed);
      expect(elsewhere.getPlayers().find((p) => p.id === free.id)!.draftCost).toBeUndefined();
      expect(elsewhere.getPlayers().find((p) => p.id === ids[0])!.draftCost).toBe(40);
      // One snake pick has been assigned under the restored order, so the
      // backup laptop puts the same team on the clock this one would.
      expect(elsewhere.getSnakeOnTheClock()!.team.id).toBe(service.getSnakeOnTheClock()!.team.id);
    });

    it('reads a file written before the snake existed as an all-auction draft', () => {
      // The missing field means every pick was bought, which is what it was —
      // not a value to guess at.
      const legacy = JSON.stringify({
        kind: 'draft-vault-draft',
        version: 1,
        league: leagueShape({ auctionSheetSize: 50 }),
        budgets: [],
        picks: [{ playerId: service.getAvailablePlayers()[0].id, teamId: 'team-1', cost: 25 }],
      });

      const result = service.importDraft(legacy);
      expect(result).toMatchObject({ ok: true, restored: 1 });
      expect(service.getDraftedPlayers()[0].draftCost).toBe(25);
      expect(service.getHistory()[0].phase).toBe('auction');
    });

    it('keeps the storage version at 2, so the draft already in the browser replays', () => {
      // Bumping it would make restore() refuse the draft sitting in the owner's
      // localStorage right now, which is the one copy that matters on the night.
      service.draftPlayer(service.getAvailablePlayers()[0].id, 'team-1', 10);
      const raw = JSON.parse(localStorage.getItem('draft-vault:auction-draft:v2')!);
      expect(raw.version).toBe(2);
      expect(raw.picks[0].phase).toBe('auction');
    });
  });

  describe('the advice layer', () => {
    const intoSnake = () => {
      service.setAuctionSheet(smallSheet(service, 20));
      finishAuction(service);
      return service.getSnakeOnTheClock()!;
    };

    it('says nothing about a bid once there is no bidding', () => {
      const slot = intoSnake();
      const player = service.getAvailablePlayers()[0];
      const analytics = service.getPlayerAnalytics(player.id, slot.team.id);

      expect(adviseOnBid(player, slot.team, analytics, service, 10)).toBeNull();
      expect(adviseOnNomination(service.getPlayers(), slot.team, service)).toBeNull();
    });

    it('carries no stop price, because the pick is free', () => {
      const slot = intoSnake();
      const player = service.getAvailablePlayers()[0];
      const advice = adviseOnSnakePick(player, slot.team, service.getPlayers(), service)!;

      expect(advice).not.toBeNull();
      expect(advice.stopAt).toBeNull();
      expect(advice.reasons.length).toBeGreaterThan(0);
    });

    it('reads need off the league lineup rather than a table of its own', () => {
      // The advisor's module-local STARTERS says WR:2 where this league fields
      // three, so a roster with two receivers has to still read as short one.
      const slot = intoSnake();
      const receivers = service.getAvailablePlayers().filter((p) => p.position === 'WR');
      // Two receivers onto the team on the clock, taking its turns as they come.
      for (let taken = 0; taken < 2; ) {
        const up = service.getSnakeOnTheClock()!;
        if (up.team.id === slot.team.id) {
          service.draftSnakePick(receivers[taken].id, up.team.id);
          taken++;
        } else {
          service.draftSnakePick(
            service.getAvailablePlayers().find((p) => p.position === 'TE')!.id,
            up.team.id
          );
        }
      }

      const team = service.getTeams().find((t) => t.id === slot.team.id)!;
      expect(team.roster.WR).toBe(2);
      const advice = adviseOnSnakePick(receivers[9], team, service.getPlayers(), service)!;
      expect(advice.reasons[0]).toContain('1 starting WR');
    });

    it('refuses to advise a team that is not on the clock', () => {
      const slot = intoSnake();
      const other = service.getTeams().find((team) => team.id !== slot.team.id)!;
      const advice = adviseOnSnakePick(
        service.getAvailablePlayers()[0],
        other,
        service.getPlayers(),
        service
      )!;
      expect(advice.verdict).toBe('PASS');
    });

    it('says nothing at all during the auction', () => {
      service.setAuctionSheet(smallSheet(service, 20));
      expect(
        adviseOnSnakePick(
          service.getAvailablePlayers()[0],
          service.getTeams()[0],
          service.getPlayers(),
          service
        )
      ).toBeNull();
    });
  });
});

describe('what the auction half must not learn from the snake', () => {
  beforeEach(() => localStorage.clear());

  it('names the snake rather than a price when a taken player is nominated', () => {
    // The already-drafted message interpolated `draftCost` unconditionally, so
    // a player the snake had taken produced "already went to Team 4 for
    // $undefined" the first time anybody typed his name into the search box.
    const service = new AuctionDraftService(leagueShape({ auctionSheetSize: 50 }));
    service.setAuctionSheet(smallSheet(service, 20));
    finishAuction(service);
    const slot = service.getSnakeOnTheClock()!;
    const player = service.getAvailablePlayers()[0];
    service.draftSnakePick(player.id, slot.team.id);

    const check = service.validateBid(player.id, 'team-1', 5);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe('already-drafted');
      expect(check.message).not.toContain('undefined');
      expect(check.message).toContain('snake');
    }
  });

  it('keeps a snake pick free through a re-price', () => {
    // An import rebuilds every player and copies the draft state back on. A
    // free pick that came back carrying a cost of zero would be a player the
    // room is then told it bought for nothing.
    const service = new AuctionDraftService(leagueShape({ auctionSheetSize: 50 }));
    const ids = smallSheet(service, 20);
    service.setAuctionSheet(ids);
    finishAuction(service);
    const slot = service.getSnakeOnTheClock()!;
    const player = service.getAvailablePlayers()[0];
    service.draftSnakePick(player.id, slot.team.id);

    service.setCustomRankings({ [player.id]: { value: 30, rank: 1, tier: 1 } });

    const after = service.getPlayers().find((p) => p.id === player.id)!;
    expect(after.isDrafted).toBe(true);
    expect(after.draftCost).toBeUndefined();
    expect(service.getMarketState().premium).toBeNull();
  });
});

describe('what a reorder must not be able to destroy', () => {
  /**
   * Three reviewers found the same trigger from three directions, and the
   * principle underneath is worth stating: a logged pick is a record of what
   * happened, not a proposal to be re-adjudicated against today's rules. The
   * snake order lives outside the pick log, so anything that re-derives a
   * pick's legality from the current order can lose it.
   */
  beforeEach(() => localStorage.clear());

  const started = (sheetSize = 20, snakePicks = 6) => {
    const service = new AuctionDraftService(leagueShape({ teams: 12, budget: 200 }));
    service.setAuctionSheet(smallSheet(service, sheetSize));
    finishAuction(service);
    for (let i = 0; i < snakePicks; i++) {
      const clock = service.getSnakeOnTheClock()!;
      const player = service.getAvailablePlayers()[0];
      expect(service.draftSnakePick(player.id, clock.team.id)).toBe(true);
    }
    return service;
  };

  it('keeps every snake pick when the order is reordered and the page reloads', () => {
    // The bug: replay sent stored snake picks back through validateSnakePick,
    // which asks whose turn it is under the order in force NOW. Reordering made
    // every logged snake pick fail, and the reloading window wrote the
    // truncated log back over the good one.
    const service = started();
    const before = service.getHistory().length;
    expect(service.getSnakePickCount()).toBe(6);

    service.setSnakeOrder([...service.getSnakeOrder()].reverse().map((team) => team.id));

    const second = new AuctionDraftService(leagueShape({ teams: 12, budget: 200 }));
    second.reloadFromStorage();

    expect(second.getHistory().length).toBe(before);
    expect(second.getSnakePickCount()).toBe(6);
  });

  it('keeps them when a sheet is imported while the room is in the snake', () => {
    // The same root cause by another door: a new sheet flips the phase back to
    // auction, so every logged snake pick failed as not-in-snake.
    const service = started();
    const before = service.getHistory().length;

    const other = [...service.getPlayers()]
      .filter((player) => !player.isDrafted)
      .slice(0, 30)
      .map((player) => player.id);
    service.setAuctionSheet(other);

    const reloaded = new AuctionDraftService(leagueShape({ teams: 12, budget: 200 }));
    reloaded.reloadFromStorage();
    expect(reloaded.getHistory().length).toBe(before);
    expect(reloaded.getSnakePickCount()).toBe(6);
  });

  it('never puts a team that is already full on the clock after a reorder', () => {
    // The second bug with the same trigger: the walk rebuilt rosters as the
    // snake found them and re-ran from seat zero under the new order, so picks
    // already taken were re-attributed and the clock landed on a full team.
    // Every player then rejected as roster-full, the draft never complete, and
    // no control in the room to get out of it.
    const service = started(20, 5);
    service.setSnakeOrder([...service.getSnakeOrder()].reverse().map((team) => team.id));

    const clock = service.getSnakeOnTheClock();
    expect(clock).toBeDefined();
    const roster = Object.values(clock!.team.roster).reduce((a, b) => a + b, 0);
    expect(roster).toBeLessThan(16);
  });

  it('still reaches a complete draft after a reorder mid-snake', () => {
    // The wedge showed up as a draft that simply stopped: 36 of 141 picks made
    // and 105 never reachable. Driving it to the end is the only assertion that
    // catches that.
    const service = started(20, 5);
    service.setSnakeOrder([...service.getSnakeOrder()].reverse().map((team) => team.id));

    for (let guard = 0; guard < 400 && !service.isComplete(); guard++) {
      const clock = service.getSnakeOnTheClock();
      if (!clock) break;
      const player = service
        .getAvailablePlayers()
        .find((p) => service.validateSnakePick(p.id, clock.team.id).ok);
      if (!player) break;
      service.draftSnakePick(player.id, clock.team.id);
    }

    expect(service.isComplete()).toBe(true);
    for (const team of service.getTeams()) {
      expect(Object.values(team.roster).reduce((a, b) => a + b, 0)).toBe(16);
    }
  });

  it('survives a reorder through a draft file, which is a different door again', () => {
    const service = started();
    service.setSnakeOrder([...service.getSnakeOrder()].reverse().map((team) => team.id));
    const file = service.exportDraft();

    const loaded = new AuctionDraftService(leagueShape({ teams: 12, budget: 200 }));
    const result = loaded.importDraft(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.skipped).toBe(0);
    expect(loaded.getSnakePickCount()).toBe(6);
  });
});
