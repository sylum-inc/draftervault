import { beforeEach, describe, expect, it } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';

/**
 * Players the market drafts that the pool has never heard of.
 *
 * nflverse's roster file lags signings, so established players on new clubs can
 * be inside the top 230 of real drafts and absent from a pool built the same
 * week. A player the room is taking that this board cannot put on the block is
 * the worst shape a gap can take on the night.
 *
 * The load-bearing property is not that they appear — it is that they appear
 * *without touching the arithmetic*. They have no projection, and a player with
 * no projected points inside `replacementLevels` would drag his position's
 * replacement down and move every price on the board on the strength of a
 * number nobody has.
 */
describe('market-only players', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
  });

  const absentees = () => service.getPlayers().filter((p) => p.marketOnly);

  it('puts the players real drafts are taking on the board', () => {
    expect(absentees().length).toBeGreaterThan(5);
  });

  it('moves not one price and not one replacement level', () => {
    // The whole design. If this fails, a player with no projection has reached
    // `pricePool`, and every dollar on the board is now partly invented.
    const levels = Object.fromEntries(
      (['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const).map((p) => [
        p,
        service.getReplacementLevel(p),
      ])
    );
    expect(levels.WR).toBeGreaterThan(50);
    for (const player of absentees()) {
      expect(player.projectedPoints).toBe(0);
      expect(player.valueOverReplacement).toBe(0);
    }
    // Replacement is set by the pool's own players; the absentees sit outside
    // it, so a WR with zero points has not become the WR replacement level.
    const worstRealWr = Math.min(
      ...service
        .getPlayers()
        .filter((p) => p.position === 'WR' && !p.marketOnly)
        .map((p) => p.projectedPoints)
    );
    expect(levels.WR).toBeGreaterThanOrEqual(worstRealWr);
  });

  it('sits at the dollar floor until the market prices him', () => {
    // $1 is not a claim that he is worth a dollar; it is where every player we
    // cannot price sits.
    for (const player of absentees()) expect(player.estimatedValue).toBe(1);
  });

  it('is priced by the market board, which is the only opinion anybody has', () => {
    service.applyConsensusBoard();
    const priced = absentees().filter((p) => p.estimatedValue > 1);
    expect(priced.length).toBeGreaterThan(3);
    for (const player of priced) {
      expect(player.customRanking?.notes).toBe('adp');
      // Ours stays visible beside theirs, as it does for every override.
      expect(player.modelValue).toBe(1);
    }
  });

  it('can be nominated and bought like anybody else', () => {
    service.applyConsensusBoard();
    const target = absentees()[0];
    expect(service.validateBid(target.id, 'team-1', 3).ok).toBe(true);
    expect(service.draftPlayer(target.id, 'team-1', 3)).toBe(true);
    const after = service.getPlayers().find((p) => p.id === target.id);
    expect(after?.isDrafted).toBe(true);
    expect(after?.draftCost).toBe(3);
  });

  it('survives a reload, because he is rebuilt from the same snapshot', () => {
    service.applyConsensusBoard();
    const target = absentees()[0];
    service.draftPlayer(target.id, 'team-1', 4);
    const replayed = new AuctionDraftService();
    // The app restores explicitly on mount; the constructor does not.
    expect(replayed.restore()).toBe(1);
    const found = replayed.getPlayers().find((p) => p.id === target.id);
    expect(found?.isDrafted).toBe(true);
    expect(found?.draftCost).toBe(4);
  });

  it('gives every one of them a distinct id', () => {
    const ids = absentees().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('market:')).toBe(true);
  });

  it('is not offered as a bargain, having no opinion to disagree with', () => {
    const rows = service.getBargains(40);
    expect(rows.some((row) => row.player.marketOnly)).toBe(false);
  });
});
