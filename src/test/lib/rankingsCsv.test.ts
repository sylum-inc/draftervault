import { describe, it, expect } from 'vitest';
import {
  normaliseName,
  parseAndResolve,
  parseRankings,
  resolveRankings,
  splitCsvLine,
  toOverrides,
  type Candidate,
} from '@/lib/rankingsCsv';

const roster: Candidate[] = [
  { id: '1', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' },
  { id: '2', name: "Ja'Marr Chase", position: 'WR', team: 'CIN' },
  { id: '3', name: 'Kenneth Walker III', position: 'RB', team: 'SEA' },
  // Two Smiths, on purpose: this is the case the old importer got wrong.
  { id: '4', name: 'Jonnu Smith', position: 'TE', team: 'PIT' },
  { id: '5', name: 'Roquan Smith', position: 'DST', team: 'BAL' },
  { id: '6', name: 'Irv Smith', position: 'TE', team: 'HOU' },
];

describe('splitCsvLine', () => {
  it('keeps a comma inside a quoted field', () => {
    expect(splitCsvLine('Gibbs,RB,1,55,1,"Volume, goal line"')).toEqual([
      'Gibbs',
      'RB',
      '1',
      '55',
      '1',
      'Volume, goal line',
    ]);
  });

  it('reads back a doubled quote the way the app writes it', () => {
    // DraftResults exports every cell quoted with "" for a literal quote, so a
    // naive split cannot reread Draft Vault's own CSV.
    expect(splitCsvLine('"Smith, Jonnu","a ""safe"" pick"')).toEqual([
      'Smith, Jonnu',
      'a "safe" pick',
    ]);
  });

  it('handles empty trailing cells', () => {
    expect(splitCsvLine('Gibbs,RB,1,,,')).toEqual(['Gibbs', 'RB', '1', '', '', '']);
  });
});

describe('normaliseName', () => {
  it('ignores punctuation and generational suffixes', () => {
    expect(normaliseName("Ja'Marr Chase")).toBe('jamarr chase');
    expect(normaliseName('Kenneth Walker III')).toBe('kenneth walker');
    expect(normaliseName('A.J. Brown')).toBe('aj brown');
  });

  it('keeps a lone suffix-like name intact', () => {
    // "V" is this person's whole name here; stripping it would leave nothing.
    expect(normaliseName('V')).toBe('v');
  });
});

describe('parseRankings', () => {
  it('reads the shipped template', () => {
    const { rows } = parseRankings(
      ['Name,Position,Rank,Value,Tier,Notes', 'Jahmyr Gibbs,RB,1,55,1,Workhorse'].join('\n')
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Jahmyr Gibbs',
      position: 'RB',
      rank: 1,
      value: 55,
      tier: 1,
    });
  });

  it('follows the header rather than assuming column order', () => {
    const { rows } = parseRankings(['Rank,Player,Price,Pos', '3,Jahmyr Gibbs,$41,RB'].join('\n'));
    expect(rows[0]).toMatchObject({ name: 'Jahmyr Gibbs', rank: 3, value: 41, position: 'RB' });
  });

  it('accepts a file with no header at all', () => {
    const { rows } = parseRankings('Jahmyr Gibbs,RB,1,55');
    expect(rows[0]).toMatchObject({ name: 'Jahmyr Gibbs', rank: 1, value: 55 });
  });

  it('normalises the ways a defence is spelled', () => {
    expect(parseRankings('Ravens,D/ST,1,3').rows[0].position).toBe('DST');
    expect(parseRankings('Ravens,DEF,1,3').rows[0].position).toBe('DST');
  });

  it('reports a nameless row instead of importing a blank', () => {
    const { rows, skipped } = parseRankings('Name,Rank\n,4');
    expect(rows).toHaveLength(0);
    expect(skipped[0]).toMatchObject({ line: 2 });
  });

  it('ignores blank lines', () => {
    expect(parseRankings('\n\nJahmyr Gibbs,RB,1\n\n').rows).toHaveLength(1);
  });
});

describe('resolveRankings', () => {
  it('matches an exact name', () => {
    const [result] = resolveRankings([{ line: 1, name: 'Jahmyr Gibbs' }], roster);
    expect(result).toMatchObject({ status: 'matched', player: { id: '1' } });
  });

  it('matches across punctuation and suffixes', () => {
    expect(resolveRankings([{ line: 1, name: 'JaMarr Chase' }], roster)[0]).toMatchObject({
      status: 'matched',
      player: { id: '2' },
    });
    expect(resolveRankings([{ line: 1, name: 'Kenneth Walker' }], roster)[0]).toMatchObject({
      status: 'matched',
      player: { id: '3' },
    });
  });

  it('matches an abbreviated name when it is unambiguous', () => {
    expect(resolveRankings([{ line: 1, name: 'J. Gibbs' }], roster)[0]).toMatchObject({
      status: 'matched',
      player: { id: '1' },
    });
  });

  it('refuses to guess between two players of the same name', () => {
    // The old importer took the first player whose name merely *contained*
    // "smith", which with 599 players silently binds the wrong one.
    const [result] = resolveRankings([{ line: 1, name: 'Smith' }], roster);
    expect(result.status).not.toBe('matched');
  });

  it('reports the candidates when a surname is shared', () => {
    const [result] = resolveRankings([{ line: 1, name: 'I. Smith' }], roster);
    expect(result).toMatchObject({ status: 'matched', player: { id: '6' } });

    const withRoster: Candidate[] = [
      ...roster,
      { id: '7', name: 'Ian Smith', position: 'TE', team: 'NYJ' },
    ];
    const [clash] = resolveRankings([{ line: 1, name: 'I. Smith' }], withRoster);
    expect(clash.status).toBe('ambiguous');
    if (clash.status === 'ambiguous') expect(clash.options.map((o) => o.id)).toEqual(['6', '7']);
  });

  it('uses a stated position to narrow, not to tie-break after the fact', () => {
    const twins: Candidate[] = [
      { id: 'a', name: 'Mike Williams', position: 'WR', team: 'NYJ' },
      { id: 'b', name: 'Mike Williams', position: 'TE', team: 'LV' },
    ];
    expect(
      resolveRankings([{ line: 1, name: 'Mike Williams', position: 'TE' }], twins)[0]
    ).toMatchObject({
      status: 'matched',
      player: { id: 'b' },
    });
    expect(resolveRankings([{ line: 1, name: 'Mike Williams' }], twins)[0].status).toBe(
      'ambiguous'
    );
  });

  it('reports a player who is not in the pool', () => {
    expect(resolveRankings([{ line: 1, name: 'Nobody Here' }], roster)[0].status).toBe('unmatched');
  });
});

describe('toOverrides', () => {
  it('keeps only the fields the file actually stated', () => {
    const parsed = parseAndResolve('Name,Rank\nJahmyr Gibbs,4', roster);
    expect(toOverrides(parsed.resolutions)).toEqual({ '1': { rank: 4 } });
  });

  it('never produces a value below a dollar', () => {
    const parsed = parseAndResolve('Name,Value\nJahmyr Gibbs,0', roster);
    expect(toOverrides(parsed.resolutions)['1'].value).toBe(1);
  });

  it('rounds a fractional value to whole dollars', () => {
    const parsed = parseAndResolve('Name,Value\nJahmyr Gibbs,41.6', roster);
    expect(toOverrides(parsed.resolutions)['1'].value).toBe(42);
  });

  it('leaves unmatched and ambiguous rows out entirely', () => {
    const parsed = parseAndResolve('Name,Value\nNobody Here,40\nSmith,20', roster);
    expect(toOverrides(parsed.resolutions)).toEqual({});
  });

  it('reads a file the app itself exported', () => {
    const exported = ['"Name","Value","Notes"', '"Ja\'Marr Chase","62","a ""safe"" pick"'].join(
      '\n'
    );
    const parsed = parseAndResolve(exported, roster);
    expect(toOverrides(parsed.resolutions)).toEqual({
      '2': { value: 62, notes: 'a "safe" pick' },
    });
  });
});
