import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AuctionDraftService,
  CorrectionCheck,
  PickCorrection,
  Player,
  Team,
} from '@/services/auctionDraftService';
import { getIdentity } from '@/services/nflIdentity';
import { matchesSearch, searchable } from '@/lib/playerSearch';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';

interface PickEditorProps {
  service: AuctionDraftService;
  /** Where the pick sits in the log — the one thing a correction addresses. */
  index: number;
  players: Player[];
  teams: Team[];
  /** Told what the correction did, so the room can re-read the engine. */
  onApplied: (result: { restored: number; skipped: number }) => void;
  onClose: () => void;
}

/** How many names to offer at once: enough to disambiguate, not a second board. */
const MATCHES = 6;

/**
 * Correcting one pick, from the board where the mistake gets noticed.
 *
 * Everything here is in service of one rule: nothing is applied before the room
 * has been told what it costs. A correction replays the whole log, and a raised
 * price or a player who is suddenly taken twice can leave a later pick with no
 * legal way to have happened — so the count of what would be lost is on screen,
 * with the picks named, while the Apply button is still unpressed.
 *
 * The shape is the confirm dialog's and the import panel's, deliberately: this
 * is the third thing in the app that asks before it destroys something, and a
 * new visual language for it would make it read as a different kind of act.
 */
export const PickEditor = ({
  service,
  index,
  players,
  teams,
  onApplied,
  onClose,
}: PickEditorProps) => {
  const pick = service.getHistory()[index];
  const closeRef = useRef<HTMLButtonElement>(null);

  const [playerId, setPlayerId] = useState(pick?.playerId ?? '');
  const [teamId, setTeamId] = useState(pick?.teamId ?? '');
  const [cost, setCost] = useState(pick?.cost != null ? String(pick.cost) : '');
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // The editor opens on top of the draft board, and the hook's stack is what
  // keeps one keystroke from closing both. The `stopPropagation` that used to
  // live here could not have done it: it does not stop a second listener on
  // the same node, and both would have been on `document`.
  useDismissOnEscape(onClose);

  const named = (player: Player): string => getIdentity(player.id)?.name ?? player.name;

  /**
   * Who can be put in this slot: anybody still on the board, plus the player
   * already in it. Leaving him out would make the list say he is unavailable
   * for the pick that is his own.
   */
  const candidates = useMemo(() => {
    const needle = searchable(query.trim());
    const keyed = players.map((player) => ({
      player,
      key: searchable(`${player.name} ${named(player)} ${player.team}`),
    }));
    // Drafted players are offered too, marked with where they went. The
    // correction this whole panel exists for is "that was the wrong man, and
    // the right one is who I recorded three picks later" — and excluding taken
    // players made exactly that unreachable, in both directions, while telling
    // the owner "nobody on the board by that name" about a player sitting in
    // the grid behind the dialog. Choosing one is not silently allowed: the
    // preview replays the log and reports him as taken twice, which is the
    // honest cost and is what the warning box is for.
    const matched = keyed.filter(({ key }) => matchesSearch(key, needle));
    // The recorded player first, so the pick being edited is never off the end
    // of a six-name list.
    matched.sort((a, b) => {
      const own = (entry: (typeof keyed)[number]) => (entry.player.id === pick?.playerId ? 0 : 1);
      return own(a) - own(b);
    });
    return matched.slice(0, MATCHES).map(({ player }) => player);
  }, [players, query, pick?.playerId]);

  const chosen = players.find((player) => player.id === playerId);
  const snake = pick?.phase === 'snake';

  /**
   * Only what actually differs is sent.
   *
   * An amendment that restates the price it already has is still a price, and
   * on a snake pick the engine is right to refuse one — so a correction that
   * only moves the team must not carry a cost field at all.
   */
  const change: PickCorrection = useMemo(() => {
    if (!pick) return {};
    const next: PickCorrection = {};
    if (playerId && playerId !== pick.playerId) next.playerId = playerId;
    if (teamId && teamId !== pick.teamId) next.teamId = teamId;
    if (!snake) {
      const amount = Number.parseInt(cost, 10);
      if (Number.isFinite(amount) && amount !== pick.cost) next.cost = amount;
    }
    return next;
  }, [pick, playerId, teamId, cost, snake]);

  const touched = Object.keys(change).length > 0;

  const preview: CorrectionCheck | null = useMemo(
    () => (touched ? service.previewCorrection(index, change) : null),
    [service, index, change, touched]
  );

  if (!pick) return null;

  const original = players.find((player) => player.id === pick.playerId);

  const apply = () => {
    const result = service.correctPick(index, change);
    if (!result.ok) {
      setProblem(result.reason);
      return;
    }
    onApplied(result);
  };

  const lost = preview?.ok ? preview.invalidated : [];
  const blocked = preview !== null && !preview.ok;

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Correct a pick">
      <button type="button" className="dr-modal-scrim" aria-label="Cancel" onClick={onClose} />

      <article className="dr-modal-panel dr-confirm dr-pickedit">
        <h2 className="dr-stage-name" style={{ fontSize: 22 }}>
          Pick #{index + 1}
        </h2>
        <p className="dr-meter-note">
          Recorded as {original ? named(original) : 'a player the pool no longer has'} to{' '}
          {teams.find((team) => team.id === pick.teamId)?.name ?? 'a team'}
          {pick.cost != null ? ` for $${pick.cost}` : ' in the snake, for nothing'}. Correcting it
          replays the whole draft from the amended log.
        </p>

        <label className="dr-field">
          <span className="dr-eyebrow">Player</span>
          <input
            className="dr-input"
            value={query}
            placeholder={chosen ? named(chosen) : 'Search for the right player…'}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search for the right player"
          />
        </label>
        <ul className="dr-pickedit-matches">
          {candidates.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                className="dr-linkish"
                aria-pressed={player.id === playerId}
                onClick={() => {
                  setPlayerId(player.id);
                  setProblem(null);
                }}
              >
                {named(player)}
                <em>
                  {player.position} · {player.team}
                  {player.isDrafted && player.id !== pick?.playerId && (
                    <>
                      {' · '}
                      already #{player.pickNumber} to{' '}
                      {teams.find((team) => team.id === player.draftedBy)?.name ?? 'another team'}
                    </>
                  )}
                </em>
              </button>
            </li>
          ))}
          {!candidates.length && (
            <li className="dr-meter-note">
              {query.trim() ? 'Nobody in the pool by that name.' : 'Search for the right player.'}
            </li>
          )}
        </ul>

        {/* The snake chose the team and there was no price, so there is nothing
            here to correct but the name. Offering a team select would invite an
            edit the engine is right to refuse. */}
        {!snake && (
          <div className="dr-pickedit-row">
            <label className="dr-field">
              <span className="dr-eyebrow">Won by</span>
              <select
                className="dr-select"
                value={teamId}
                onChange={(event) => {
                  setTeamId(event.target.value);
                  setProblem(null);
                }}
                aria-label="Winning team"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dr-field">
              <span className="dr-eyebrow">Price</span>
              <input
                className="dr-input"
                type="number"
                min={1}
                value={cost}
                onChange={(event) => {
                  setCost(event.target.value);
                  setProblem(null);
                }}
                aria-label="Price"
              />
            </label>
          </div>
        )}

        {/* What it costs, before it costs it. */}
        {!touched && <p className="dr-meter-note">Nothing changed yet.</p>}
        {blocked && preview && !preview.ok && <p className="dr-league-warning">{preview.reason}</p>}
        {preview?.ok && lost.length === 0 && (
          <p className="dr-meter-note" style={{ color: 'var(--dr-value)' }}>
            Every one of the {preview.restored} picks still replays. Nothing else changes.
          </p>
        )}
        {preview?.ok && lost.length > 0 && (
          <div className="dr-league-warning">
            <strong>
              {lost.length} later pick{lost.length === 1 ? '' : 's'} could no longer have happened
            </strong>
            <ul className="dr-pickedit-lost">
              {lost.map((entry) => (
                <li key={entry.pickNumber}>
                  #{entry.pickNumber} {entry.player} to {entry.team} — {entry.reason}
                </li>
              ))}
            </ul>
            Applying this drops {lost.length === 1 ? 'it' : 'them'} from the draft.
          </div>
        )}

        {problem && (
          <p className="dr-meter-note" role="status" style={{ color: 'var(--dr-danger)' }}>
            {problem}
          </p>
        )}

        <div className="dr-results-actions">
          <button
            type="button"
            className="dr-button dr-button-primary"
            onClick={apply}
            disabled={!touched || blocked}
          >
            {lost.length ? `Apply, losing ${lost.length}` : 'Apply the correction'}
          </button>
          <button ref={closeRef} type="button" className="dr-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </article>
    </div>
  );
};
