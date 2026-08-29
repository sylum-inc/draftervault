import { describe, it, expect } from 'vitest';
import poolData from '@/data/nfl/pool.json';
import { matchesSearch, searchable } from '@/lib/playerSearch';

describe('searchable', () => {
  it('drops the punctuation nobody types under pressure', () => {
    expect(searchable("Ja'Marr Chase")).toBe('jamarr chase');
    expect(searchable('Amon-Ra St. Brown')).toBe('amonra st brown');
    expect(searchable("Wan'Dale Robinson")).toBe('wandale robinson');
  });

  it('keeps spaces, so a surname still matches on its own', () => {
    expect(searchable('Amon-Ra St. Brown')).toContain(' st brown');
  });

  it('keeps generational suffixes, unlike the importer', () => {
    // The importer strips these because two sources spell them differently.
    // Here somebody typing "walker iii" should still find him.
    expect(searchable('Kenneth Walker III')).toBe('kenneth walker iii');
  });
});

describe('matchesSearch', () => {
  it('shows everything before anything is typed', () => {
    expect(matchesSearch('jamarr chase', '')).toBe(true);
  });

  it('matches a partial name', () => {
    expect(matchesSearch('jamarr chase wr cin', 'jama')).toBe(true);
    expect(matchesSearch('jamarr chase wr cin', 'cin')).toBe(true);
    expect(matchesSearch('jamarr chase wr cin', 'zzz')).toBe(false);
  });
});

describe('against the shipped pool', () => {
  const key = (name: string) => searchable(name);

  it('finds every player whose printed name carries punctuation', () => {
    // These are exactly the names the old substring match could not find.
    const awkward = poolData.players.filter((p) => /[^A-Za-z0-9 ]/.test(p.name));
    expect(awkward.length).toBeGreaterThan(0);

    for (const player of awkward) {
      const typed = searchable(player.name);
      expect(matchesSearch(key(player.name), typed)).toBe(true);
    }
  });

  it("finds Ja'Marr Chase by typing jamarr", () => {
    const chase = poolData.players.find((p) => p.name.includes('Chase') && p.position === 'WR');
    expect(chase).toBeDefined();
    expect(matchesSearch(key(chase!.name), 'jamarr')).toBe(true);
    // The bug: the printed name does not contain the typed string.
    expect(chase!.name.toLowerCase().includes('jamarr')).toBe(false);
  });
});
