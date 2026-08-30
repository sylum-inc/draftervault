import { describe, expect, it } from 'vitest';
import { describeMarket, marketAge, marketFreshness, validateMarket } from '@/lib/marketContract';
import { marketOrder, consensusOverrides, consensusCoverage } from '@/lib/consensusBoard';

const snapshot = (over: Record<string, unknown> = {}) => ({
  source: 'Fantasy Football Calculator Half-PPR',
  scoring: 'Half-PPR',
  teams: 12,
  drafts: 3257,
  from: '2026-08-25',
  to: '2026-08-30',
  fetchedAt: '2026-08-30T14:00:00.000Z',
  entries: [{ gsis: 'a', adp: 1.5 }],
  ...over,
});
const NOW = Date.parse('2026-09-02T00:00:00Z');

describe('marketContract', () => {
  it('ages from the last day of drafts, not from when the file was downloaded', () => {
    // Re-downloading an unchanged file does not make the market newer, and a
    // refresh that reports "fetched today" over week-old drafts is exactly the
    // reassurance this is meant to withhold.
    expect(marketAge(snapshot(), NOW)).toBe(3);
    expect(marketAge(snapshot({ fetchedAt: '2026-09-02T00:00:00.000Z' }), NOW)).toBe(3);
  });

  it('bands freshness rather than firing one alarm', () => {
    expect(marketFreshness({ to: '2026-09-01' }, NOW)).toBe('fresh');
    expect(marketFreshness({ to: '2026-08-30' }, NOW)).toBe('fresh');
    expect(marketFreshness({ to: '2026-08-26' }, NOW)).toBe('ageing');
    expect(marketFreshness({ to: '2026-08-01' }, NOW)).toBe('stale');
    expect(marketFreshness(null, NOW)).toBe('unknown');
  });

  it('never reports a negative age for a snapshot dated in the future', () => {
    expect(marketAge({ to: '2027-01-01' }, NOW)).toBe(0);
  });

  it('describes itself in one line, naming source, sample and age', () => {
    const line = describeMarket(validateMarket(snapshot()), NOW);
    expect(line).toContain('Fantasy Football Calculator');
    expect(line).toContain('3,257');
    expect(line).toContain('3 days old');
  });

  it('refuses a file that is not a snapshot rather than half-reading it', () => {
    expect(validateMarket(null)).toBeNull();
    expect(validateMarket({})).toBeNull();
    expect(validateMarket(snapshot({ entries: [] }))).toBeNull();
    expect(validateMarket(snapshot({ to: '' }))).toBeNull();
    expect(validateMarket(snapshot({ source: '' }))).toBeNull();
  });

  it('drops a malformed entry but keeps the snapshot around it', () => {
    const out = validateMarket(
      snapshot({
        entries: [
          { gsis: 'a', adp: 2 },
          { gsis: '', adp: 3 },
          { gsis: 'c', adp: -1 },
        ],
      })
    );
    expect(out?.entries.map((e) => e.gsis)).toEqual(['a']);
  });
});

describe('marketOrder', () => {
  const p = (gsis: string, adp: number | null, consensusRank: number | null) => ({
    gsis,
    position: 'WR',
    auctionValue: 10,
    adp,
    consensusRank,
  });

  it('puts every drafted player ahead of one only the panel ranked', () => {
    const out = marketOrder([p('panel', null, 1), p('drafted', 90, 400)]);
    expect(out.map((e) => e.gsis)).toEqual(['drafted', 'panel']);
  });

  it('never averages two scales that measure different things', () => {
    // An ADP of 41.2 and a consensus rank of 55 are not commensurable; only
    // the claim "real drafts took him" is.
    const out = marketOrder([p('a', 41.2, 55), p('b', 42, 1)]);
    expect(out.map((e) => e.gsis)).toEqual(['a', 'b']);
    expect(out.map((e) => e.marketSource)).toEqual(['adp', 'adp']);
  });

  it('leaves out a player neither source has an opinion about', () => {
    expect(marketOrder([p('nobody', null, null)])).toEqual([]);
  });
});

describe('consensus coverage', () => {
  it('reports the two sources separately, so neither can claim the other', () => {
    const players = [
      { gsis: 'a', position: 'WR', auctionValue: 9, adp: 3, consensusRank: 4 },
      { gsis: 'b', position: 'WR', auctionValue: 5, adp: null, consensusRank: 40 },
      { gsis: 'c', position: 'WR', auctionValue: 1, adp: null, consensusRank: null },
    ];
    expect(consensusCoverage(players)).toEqual({
      ranked: 2,
      of: 3,
      fromAdp: 1,
      fromConsensus: 1,
    });
    const out = consensusOverrides(players);
    expect(out.a.notes).toBe('adp');
    expect(out.b.notes).toBe('consensus');
    expect(out.c).toBeUndefined();
  });
});
