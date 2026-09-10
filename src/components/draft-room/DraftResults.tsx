import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player, PlayerPosition, Team } from '@/services/auctionDraftService';
import { saveTextFile } from '@/lib/saveFile';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';

interface DraftResultsProps {
  players: Player[];
  teams: Team[];
  onClose: () => void;
}

/** The lineup a team actually starts each week. */
const LINEUP: Array<[PlayerPosition, number]> = [
  ['QB', 1],
  ['RB', 2],
  ['WR', 3],
  ['TE', 1],
  ['K', 1],
  ['DST', 1],
];
const FLEX_POSITIONS: PlayerPosition[] = ['RB', 'WR', 'TE'];

interface TeamResult {
  team: Team;
  roster: Player[];
  spent: number;
  listValue: number;
  surplus: number;
  starterPoints: number;
  /** How many of the roster were bought with money rather than taken free. */
  bought: number;
  grade: string;
}

/**
 * Whether this player was bought.
 *
 * `draftCost` is absent on a snake pick and zero never appears, so this is the
 * money question asked directly rather than inferred from a phase the results
 * screen would otherwise have to be handed.
 */
const wasBought = (player: Player): boolean => player.draftCost != null;

/**
 * Picks the lineup a roster would actually start, so a team is judged on the
 * points it can field rather than on everything it hoarded.
 */
const startingPoints = (roster: Player[]): number => {
  const byPosition = new Map<string, Player[]>();
  for (const player of roster) {
    if (!byPosition.has(player.position)) byPosition.set(player.position, []);
    byPosition.get(player.position)!.push(player);
  }
  for (const list of byPosition.values())
    list.sort((a, b) => b.projectedPoints - a.projectedPoints);

  let total = 0;
  const used = new Set<string>();
  for (const [position, count] of LINEUP) {
    for (const player of (byPosition.get(position) ?? []).slice(0, count)) {
      total += player.projectedPoints;
      used.add(player.id);
    }
  }
  // One flex from whatever is left at the flex-eligible positions.
  const flex = roster
    .filter((player) => FLEX_POSITIONS.includes(player.position) && !used.has(player.id))
    .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
  return Math.round(total + (flex?.projectedPoints ?? 0));
};

/** Grades are a curve across this league, not an absolute scale. */
const gradeFor = (points: number, all: number[]): string => {
  const sorted = [...all].sort((a, b) => b - a);
  const rank = sorted.indexOf(points);
  const share = rank / Math.max(1, sorted.length - 1);
  if (share <= 0.08) return 'A+';
  if (share <= 0.25) return 'A';
  if (share <= 0.42) return 'B+';
  if (share <= 0.58) return 'B';
  if (share <= 0.75) return 'C+';
  if (share <= 0.92) return 'C';
  return 'D';
};

const toCsv = (results: TeamResult[]): string => {
  const rows = [['Pick', 'Team', 'Player', 'Pos', 'NFL', 'How', 'Paid', 'Our value', 'Projected']];
  for (const result of results) {
    for (const player of result.roster) {
      rows.push([
        `${player.pickNumber ?? ''}`,
        result.team.name,
        player.name,
        player.position,
        player.team,
        // A blank Paid cell beside "snake" is the honest record. A 0 there
        // would be read by every spreadsheet as a player bought for nothing,
        // and averaging over the column would halve what the room actually paid.
        wasBought(player) ? 'auction' : 'snake',
        wasBought(player) ? `${player.draftCost}` : '',
        `${player.estimatedValue}`,
        `${player.projectedPoints}`,
      ]);
    }
  }
  // Quote every field: player names contain commas and apostrophes.
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
};

export const DraftResults = ({ players, teams, onClose }: DraftResultsProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useDismissOnEscape(onClose);

  const results = useMemo<TeamResult[]>(() => {
    const drafted = players.filter((player) => player.isDrafted);
    const rows = teams.map((team) => {
      const roster = drafted
        .filter((player) => player.draftedBy === team.id)
        .sort((a, b) => (b.draftCost ?? -1) - (a.draftCost ?? -1));
      /*
       * Money counts the auction; the lineup counts both.
       *
       * `starterPoints` is over the whole roster because a receiver taken for
       * nothing scores exactly as many points as one bought for $40 — that is
       * the team the manager will field, and the grade is a curve on it.
       *
       * Spend and list value are over the bought half only. Summing our prices
       * across free picks would credit a team with $180 of "surplus" it never
       * bid for and hand the same bonus to everybody, which is a column of
       * noise dressed as a result.
       */
      const bought = roster.filter(wasBought);
      const spent = bought.reduce((total, player) => total + (player.draftCost ?? 0), 0);
      const listValue = bought.reduce((total, player) => total + player.estimatedValue, 0);
      return {
        team,
        roster,
        spent,
        listValue,
        surplus: listValue - spent,
        starterPoints: startingPoints(roster),
        bought: bought.length,
        grade: '',
      };
    });
    const allPoints = rows.map((row) => row.starterPoints);
    for (const row of rows) row.grade = gradeFor(row.starterPoints, allPoints);
    return rows.sort((a, b) => b.starterPoints - a.starterPoints);
  }, [players, teams]);

  const csv = useMemo(() => toCsv(results), [results]);
  const totalPicks = results.reduce((total, row) => total + row.roster.length, 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  /**
   * Hand the results over as a file.
   *
   * A plain `download` link does nothing inside the published Artifact, whose
   * sandbox blocks any save a page starts itself — so this goes through the
   * viewer's own save prompt where one exists, and stays an anchor everywhere
   * else. Only a real failure is worth reporting; a viewer who declines the
   * prompt has already said what they wanted.
   */
  const download = async () => {
    setSaveError(null);
    const outcome = await saveTextFile('draft-vault-results.csv', csv);
    if (outcome.status === 'failed') setSaveError('Could not save the file — use Copy CSV.');
  };

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Draft results">
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close results"
        onClick={onClose}
      />

      <article className="dr-modal-panel dr-results">
        <header className="dr-results-head">
          <div>
            <h2 className="dr-stage-name" style={{ fontSize: 26 }}>
              Draft results
            </h2>
            <p className="dr-meter-note">
              {totalPicks} pick{totalPicks === 1 ? '' : 's'} · graded on the points each team can
              actually start
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {totalPicks === 0 ? (
          <p className="dr-empty">No picks yet. Results appear once the auction is under way.</p>
        ) : (
          <>
            <div className="dr-results-actions">
              <button type="button" className="dr-button" onClick={copy}>
                {copied ? 'Copied' : 'Copy CSV'}
              </button>
              <button type="button" className="dr-button" onClick={() => void download()}>
                Download CSV
              </button>
              <button type="button" className="dr-button" onClick={() => window.print()}>
                Print
              </button>
            </div>

            {saveError && (
              <p className="dr-meter-note" role="status" style={{ color: 'var(--dr-danger)' }}>
                {saveError}
              </p>
            )}

            <div className="dr-table-wrap">
              <table className="dr-table dr-table-compact">
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col" className="is-numeric">
                      Grade
                    </th>
                    <th scope="col" className="is-numeric">
                      Starters
                    </th>
                    <th scope="col" className="is-numeric">
                      Spent
                    </th>
                    <th scope="col" className="is-numeric">
                      Value
                    </th>
                    <th scope="col" className="is-numeric">
                      Surplus
                    </th>
                    <th scope="col" className="is-numeric" title="Bought at auction / rostered">
                      Players
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.team.id}>
                      <td className="dr-table-name">{row.team.name}</td>
                      <td className="is-numeric">
                        <span className="dr-grade" data-grade={row.grade[0]}>
                          {row.grade}
                        </span>
                      </td>
                      <td className="is-numeric dr-num" style={{ color: 'var(--dr-ink)' }}>
                        {row.starterPoints}
                      </td>
                      <td className="is-numeric dr-num">${row.spent}</td>
                      <td className="is-numeric dr-num">${row.listValue}</td>
                      <td
                        className="is-numeric dr-num"
                        style={{ color: row.surplus >= 0 ? 'var(--dr-value)' : 'var(--dr-danger)' }}
                      >
                        {row.surplus >= 0 ? '+' : '−'}${Math.abs(row.surplus)}
                      </td>
                      {/* Bought and rostered are two different counts once the
                          snake starts, and the money columns beside them are
                          about the first one only. */}
                      <td className="is-numeric dr-num">
                        {row.bought < row.roster.length
                          ? `${row.bought}/${row.roster.length}`
                          : row.roster.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="dr-footnote">
              Surplus is what a roster is worth at our prices minus what it cost, over the players
              that were actually bought. A positive number means the team bought under the model,
              not that it will score more — the grade is the points column, and that one counts
              every player on the roster however he arrived.
            </p>
          </>
        )}
      </article>
    </div>
  );
};
