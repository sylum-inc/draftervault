import { describe, it, expect } from 'vitest';
import {
  AUCTION_SHEET_EXAMPLE,
  parseAuctionSheet,
  readAuctionSheet,
  sheetPlayerIds,
} from '@/lib/auctionSheet';
import { parseRankings, type Candidate } from '@/lib/rankingsCsv';

/**
 * The two Robinsons are the point of this fixture, not decoration: the shipped
 * pool holds 27 names that collide on first-initial-plus-surname, and both
 * Robinsons are backs — so a position cannot separate them and a club can.
 */
const roster: Candidate[] = [
  { id: 'chase', name: "Ja'Marr Chase", position: 'WR', team: 'CIN' },
  { id: 'gibbs', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' },
  { id: 'bijan', name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
  { id: 'brian', name: 'Brian Robinson', position: 'RB', team: 'WSH' },
  { id: 'nabers', name: 'Malik Nabers', position: 'WR', team: 'NYG' },
  { id: 'bowers', name: 'Brock Bowers', position: 'TE', team: 'LV' },
  { id: 'nacua', name: 'Puka Nacua', position: 'WR', team: 'LAR' },
  { id: 'walker', name: 'Kenneth Walker III', position: 'RB', team: 'SEA' },
  { id: 'den', name: 'DEN Defense', position: 'DST', team: 'DEN' },
  // A second pair colliding on the same initial, so a line can carry two
  // separate ambiguities at once — the case that broke line-keyed bindings.
  { id: 'jonathan', name: 'Jonathan Taylor', position: 'RB', team: 'IND' },
  { id: 'jmari', name: "J'Mari Taylor", position: 'RB', team: 'WSH' },
];

const names = (text: string): string[] => parseAuctionSheet(text).rows.map((row) => row.name);
const matchedIds = (text: string): string[] =>
  sheetPlayerIds(readAuctionSheet(text, roster).resolutions);

describe('reading the commissioner’s sheet', () => {
  describe('the shapes it actually arrives in', () => {
    it('reads one name a line', () => {
      expect(names("Ja'Marr Chase\nJahmyr Gibbs\nMalik Nabers")).toEqual([
        "Ja'Marr Chase",
        'Jahmyr Gibbs',
        'Malik Nabers',
      ]);
    });

    it('reads a numbered list', () => {
      expect(names("1. Ja'Marr Chase\n2) Jahmyr Gibbs\n3 Malik Nabers")).toEqual([
        "Ja'Marr Chase",
        'Jahmyr Gibbs',
        'Malik Nabers',
      ]);
    });

    it('reads bullets', () => {
      expect(names("• Ja'Marr Chase\n- Jahmyr Gibbs\n* Malik Nabers")).toEqual([
        "Ja'Marr Chase",
        'Jahmyr Gibbs',
        'Malik Nabers',
      ]);
    });

    it('reads a column pasted out of a spreadsheet, which arrives tab-separated', () => {
      const rows = parseAuctionSheet("Ja'Marr Chase\tWR\tCIN\nPuka Nacua\tWR\tLAR").rows;
      expect(rows.map((row) => row.name)).toEqual(["Ja'Marr Chase", 'Puka Nacua']);
      expect(rows[1]).toMatchObject({ position: 'WR', team: 'LAR' });
    });

    it('reads a run of names run together with commas', () => {
      // The reason this file exists rather than an extension of parseRankings:
      // that reads one cell a line through a column map, so a Slack message
      // like this becomes one row and two players silently vanish off the
      // sheet — the worst failure an auction sheet can have.
      const line = "Ja'Marr Chase, Jahmyr Gibbs, Malik Nabers";
      expect(names(line)).toEqual(["Ja'Marr Chase", 'Jahmyr Gibbs', 'Malik Nabers']);
      expect(parseRankings(line).rows).toHaveLength(1);
    });

    it('keeps a comma run of names with their labels together', () => {
      // Labels attach to the name they follow, so this is two players and not
      // six rows of nonsense.
      const rows = parseAuctionSheet("Ja'Marr Chase, WR, CIN, Jahmyr Gibbs, RB, DET").rows;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ name: "Ja'Marr Chase", position: 'WR', team: 'CIN' });
      expect(rows[1]).toMatchObject({ name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' });
    });
  });

  describe('the junk that comes with them', () => {
    it('takes a position and a club off the end of a name', () => {
      expect(parseAuctionSheet("Ja'Marr Chase WR CIN").rows[0]).toMatchObject({
        name: "Ja'Marr Chase",
        position: 'WR',
        team: 'CIN',
      });
    });

    it('drops a bracketed club, a bye week and a price', () => {
      const rows = parseAuctionSheet('Bijan Robinson (ATL) BYE 8\nJahmyr Gibbs $54').rows;
      expect(rows[0]).toMatchObject({ name: 'Bijan Robinson', team: 'ATL' });
      expect(rows[1].name).toBe('Jahmyr Gibbs');
      // A sheet says who is auctioned, never what they are worth: a generated
      // price sitting beside a computed one is indistinguishable from it.
      expect(rows[1].value).toBeUndefined();
    });

    it('reads a label in front of the name too', () => {
      expect(parseAuctionSheet('1. RB Bijan Robinson').rows[0]).toMatchObject({
        name: 'Bijan Robinson',
        position: 'RB',
      });
    });

    it('does not eat an initial that happens to be a position', () => {
      // "K. Walker III" is Kenneth Walker, not a kicker called Walker. The
      // trailing period is the whole difference, and losing it loses the name.
      expect(parseAuctionSheet('K. Walker III').rows[0]).toMatchObject({
        name: 'K. Walker III',
        position: undefined,
      });
      expect(matchedIds('K. Walker III')).toEqual(['walker']);
    });

    it('leaves a team defence with a name', () => {
      // Read "Defense" as a position label and "DEN" as a club and the row has
      // nothing left to match on.
      expect(matchedIds('DEN Defense')).toEqual(['den']);
    });

    it('finds a name typed without its apostrophe', () => {
      expect(matchedIds('JaMarr Chase')).toEqual(['chase']);
    });
  });

  describe('what it refuses to read', () => {
    it('drops a header row and counts it', () => {
      const parsed = readAuctionSheet("Player\tPos\tTeam\nJa'Marr Chase\tWR\tCIN", roster);
      expect(parsed.resolutions).toHaveLength(1);
      expect(parsed.skipped).toHaveLength(1);
      expect(parsed.skipped[0].line).toBe(1);
    });

    it('drops a title and a section heading', () => {
      const parsed = readAuctionSheet('2026 AUCTION SHEET — TOP 100\nRB\nJahmyr Gibbs', roster);
      expect(parsed.resolutions).toHaveLength(1);
      expect(parsed.skipped.map((row) => row.line)).toEqual([1, 2]);
    });

    it('drops a repeat of somebody already on the sheet, and counts it', () => {
      const parsed = readAuctionSheet(
        "Ja'Marr Chase\nJahmyr Gibbs\nJa'Marr Chase\nJa’Marr Chase WR CIN",
        roster
      );
      expect(sheetPlayerIds(parsed.resolutions)).toEqual(['chase', 'gibbs']);
      // Both repeats are reported rather than quietly folded away: a sheet that
      // says 50 and imports 48 has to say why.
      expect(parsed.duplicates).toHaveLength(2);
    });

    it('ignores blank lines without counting them as anything', () => {
      const parsed = readAuctionSheet("Ja'Marr Chase\n\n   \nJahmyr Gibbs", roster);
      expect(parsed.resolutions).toHaveLength(2);
      expect(parsed.skipped).toHaveLength(0);
    });

    it('reports a name the pool does not hold', () => {
      const parsed = readAuctionSheet('Somebody Nobody', roster);
      expect(parsed.resolutions[0].status).toBe('unmatched');
      expect(sheetPlayerIds(parsed.resolutions)).toEqual([]);
    });
  });

  describe('a name that fits two players', () => {
    it('binds neither, and says which two', () => {
      const parsed = readAuctionSheet('B. Robinson', roster);
      const [resolution] = parsed.resolutions;

      expect(resolution.status).toBe('ambiguous');
      if (resolution.status === 'ambiguous') {
        expect(resolution.options.map((option) => option.id).sort()).toEqual(['bijan', 'brian']);
      }
      // Nothing goes on the sheet on a guess. Bijan is $54 and Brian is a bench
      // back; binding the wrong one is the whole failure this refuses.
      expect(sheetPlayerIds(parsed.resolutions)).toEqual([]);
    });

    it('is not settled by a position both of them play', () => {
      expect(readAuctionSheet('B. Robinson RB', roster).resolutions[0].status).toBe('ambiguous');
    });

    it('is settled by the club, which is a stated fact rather than a guess', () => {
      expect(matchedIds('B. Robinson RB ATL')).toEqual(['bijan']);
      expect(matchedIds('B. Robinson WSH')).toEqual(['brian']);
    });

    it('is settled by hand, by the person holding the sheet', () => {
      const parsed = readAuctionSheet("Ja'Marr Chase\nB. Robinson", roster);
      const { id } = parsed.resolutions[1].row;

      expect(sheetPlayerIds(parsed.resolutions, { [id]: 'brian' })).toEqual(['chase', 'brian']);
    });

    it('does not let a wrong club widen a match into a guess', () => {
      // Nobody of that name plays there, so it stays ambiguous rather than
      // falling back to whichever sorted first.
      expect(readAuctionSheet('B. Robinson KC', roster).resolutions[0].status).toBe('ambiguous');
    });
  });

  describe('the ways a name was being lost', () => {
    // Every case here was found by reading the parser adversarially, and every
    // one of them silently removed a player from the auction. They are grouped
    // together because they share a shape: the sheet looked like it imported.

    it('keeps a player whose line also carries a heading word', () => {
      // A commissioner annotates. "Tier 1", "(top 5)", "tier 2" all sit beside
      // real names, and testing whether *some* word was a heading word deleted
      // the whole line — taking the most expensive player in the auction off
      // the sheet and reporting it as "1 line skipped".
      expect(matchedIds("Ja'Marr Chase — Tier 1")).toEqual(['chase']);
      expect(matchedIds('Jahmyr Gibbs (top 5)')).toEqual(['gibbs']);
      expect(matchedIds('Malik Nabers — tier 2')).toEqual(['nabers']);
    });

    it('still drops a line that is nothing but heading words', () => {
      const parsed = readAuctionSheet('2026 AUCTION SHEET — TOP 100\nJahmyr Gibbs', roster);
      expect(parsed.resolutions).toHaveLength(1);
      expect(parsed.skipped[0].reason).toBe('a title, not a player');
    });

    it('says what it skipped, not just how many', () => {
      // A count cannot be checked against the sheet in your hand, which is
      // exactly the moment you need to check it.
      const parsed = readAuctionSheet('2026 AUCTION SHEET\nJahmyr Gibbs', roster);
      expect(parsed.skipped[0].text).toBe('2026 AUCTION SHEET');
    });

    it('reads a surname-first export as one player, not two fragments', () => {
      // A spreadsheet exported "Last, First" splits on the comma exactly like a
      // Slack run of names, so every row arrived as two unmatchable halves and
      // a 60-line sheet became 120 unmatched rows and an empty auction.
      expect(matchedIds('Robinson, Bijan')).toEqual(['bijan']);
      expect(matchedIds('Gibbs, Jahmyr\nNabers, Malik')).toEqual(['gibbs', 'nabers']);
    });

    it('still reads a comma run of full names as several players', () => {
      // The shape that must keep working, and the reason the join above is
      // restricted to two single-word cells.
      expect(matchedIds('Jahmyr Gibbs, Malik Nabers')).toEqual(['gibbs', 'nabers']);
    });

    it('keeps an initial that was typed without its full stop', () => {
      // "B" was in the noise list and "K" is a position, so "B Robinson" and
      // "K Walker" had the initial stripped and came back unmatched — losing
      // precisely the abbreviated names the stated-club narrowing rescues.
      expect(readAuctionSheet('B Robinson', roster).resolutions[0].status).toBe('ambiguous');
      expect(matchedIds('B Robinson RB ATL')).toEqual(['bijan']);
    });

    it('tells two ambiguous names on one line apart', () => {
      // Bindings were keyed by line number, but a comma run puts several
      // players on one line — which is the whole reason this parser exists. The
      // two shared a slot, so answering the second overwrote the first, both
      // rows resolved to the same player, and deduplication dropped one.
      const parsed = readAuctionSheet('B. Robinson, J. Taylor', roster);
      const [first, second] = parsed.resolutions;

      expect(first.status).toBe('ambiguous');
      expect(second.status).toBe('ambiguous');
      expect(first.row.id).not.toBe(second.row.id);
      expect(first.row.line).toBe(second.row.line);

      expect(
        sheetPlayerIds(parsed.resolutions, {
          [first.row.id]: 'bijan',
          [second.row.id]: 'jonathan',
        })
      ).toEqual(['bijan', 'jonathan']);
    });
  });

  it('keeps the sheet in the order the commissioner wrote it', () => {
    expect(matchedIds('Malik Nabers\nJahmyr Gibbs\nJa’Marr Chase')).toEqual([
      'nabers',
      'gibbs',
      'chase',
    ]);
  });

  it('reads the example it offers in the paste box', () => {
    // The placeholder is four shapes at once; if it does not parse, it is
    // teaching people a format the parser does not accept.
    const parsed = readAuctionSheet(AUCTION_SHEET_EXAMPLE, roster);
    expect(sheetPlayerIds(parsed.resolutions)).toEqual([
      'chase',
      'bijan',
      'gibbs',
      'nabers',
      'bowers',
      'nacua',
    ]);
  });
});
