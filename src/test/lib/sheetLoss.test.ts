import { describe, expect, it } from 'vitest';
import { readAuctionSheet, sheetLoss } from '@/lib/auctionSheet';
import type { Candidate } from '@/lib/rankingsCsv';

const roster: Candidate[] = [
  { id: '1', name: "Ja'Marr Chase", position: 'WR', team: 'CIN' },
  { id: '2', name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
  { id: '3', name: 'Brian Robinson', position: 'RB', team: 'SF' },
  { id: '4', name: 'Puka Nacua', position: 'WR', team: 'LAR' },
  { id: '5', name: 'Trey McBride', position: 'TE', team: 'ARI' },
  { id: '6', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' },
  { id: '7', name: 'Josh Allen', position: 'QB', team: 'BUF' },
  { id: '8', name: 'Nico Collins', position: 'WR', team: 'HOU' },
  // A deep bench of distinct names, so a test can build a long clean sheet.
  // Repeating one name would produce duplicates, which are themselves losses —
  // the fixture would then be measuring its own mistake.
  ...Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    name: `Filler Player${i}`,
    position: 'WR',
    team: 'FA',
  })),
];

const filler = (count: number) =>
  Array.from({ length: count }, (_, i) => `Filler Player${i}`).join('\n');

const loss = (text: string, bindings: Record<number, string> = {}) =>
  sheetLoss(readAuctionSheet(text, roster), bindings);

/**
 * The failure this exists for is not a rejected paste — that one is obvious.
 * It is a paste that loses a chunk out of the middle: the top still prices
 * sensibly, every check passes, and `auctionSheetSize` has quietly changed,
 * which re-prices the whole board for an auction the room is not holding.
 */
describe('sheetLoss', () => {
  it('is silent about a sheet that resolved cleanly', () => {
    const out = loss("Ja'Marr Chase\nPuka Nacua\nJahmyr Gibbs");
    expect(out).toMatchObject({ lost: 0, severity: 'none' });
    expect(out.lines).toEqual([]);
  });

  it('counts a name nobody in the pool answers to, and quotes the line', () => {
    const out = loss("Ja'Marr Chase\nSomebody Nobody\nPuka Nacua");
    expect(out.lost).toBe(1);
    expect(out.lines[0]).toContain('Somebody Nobody');
    expect(out.lines[0]).toContain('not in the pool');
    expect(out.lines[0]).toMatch(/^2:/);
  });

  it('counts an unanswered ambiguity but not one the operator has settled', () => {
    const parsed = readAuctionSheet("Ja'Marr Chase\nB. Robinson\nPuka Nacua", roster);
    const ambiguous = parsed.resolutions.find((r) => r.status === 'ambiguous');
    expect(ambiguous).toBeDefined();
    expect(sheetLoss(parsed).lost).toBe(1);
    // Binding it is the mechanism working, not a loss.
    expect(sheetLoss(parsed, { [ambiguous!.row.id]: '2' }).lost).toBe(0);
  });

  it('reports a share, so twelve lost of four hundred reads unlike twelve of thirty', () => {
    const roomy = loss(`${filler(40)}\nSomebody Nobody`);
    expect(roomy.severity).toBe('some');
    const cramped = loss("Ja'Marr Chase\nSomebody Nobody\nAnother Ghost");
    expect(cramped.severity).toBe('much');
    expect(cramped.share).toBeGreaterThan(roomy.share);
  });

  it('bands at one row in eight, where a lost name starts moving the sheet size', () => {
    const seven = [...Array(7)].map((_, i) => roster[i].name).join('\n');
    expect(loss(seven).severity).toBe('none');
    expect(loss(`${seven}\nSomebody Nobody`).severity).toBe('much');
    // Fifteen clean rows and one ghost: below one in eight.
    expect(loss(`${filler(15)}\nSomebody Nobody`).severity).toBe('some');
  });

  it('hands back text a person can act on rather than a count they cannot', () => {
    const out = loss("Ja'Marr Chase\nSomebody Nobody\nB. Robinson");
    expect(out.lines).toHaveLength(2);
    for (const line of out.lines) {
      expect(line).toMatch(/^\d+: .+ — .+$/);
    }
  });

  it('never divides by zero on an empty paste', () => {
    expect(loss('')).toMatchObject({ lost: 0, of: 0, share: 0, severity: 'none' });
  });
});
