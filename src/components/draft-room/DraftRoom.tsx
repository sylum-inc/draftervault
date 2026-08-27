import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuctionDraftService,
  type BidCheck,
  type DraftAnalytics,
  type Player,
  type Team,
} from '@/services/auctionDraftService';
import { getIdentity, refreshIdentity, snapshotMeta } from '@/services/nflIdentity';
import { useDraftPreferences } from '@/hooks/use-draft-preferences';
import { PlayerCard } from './PlayerCard';
import { PlayerTable, type TableSort } from './PlayerTable';
import { NominationStage } from './NominationStage';
import { BudgetRail } from './BudgetRail';
import { TeamsPanel } from './TeamsPanel';
import { MarketPanel } from './MarketPanel';
import { NominationClock } from './NominationClock';
import { DraftResults } from './DraftResults';
import { PlayerProfile } from './PlayerProfile';
import { CompareTray, CompareView } from './CompareTray';
import { DraftBoard } from './DraftBoard';
import { BudgetPlanner } from './BudgetPlanner';
import { BargainBoard } from './BargainBoard';
import { AdvisorPanel } from './AdvisorPanel';
import { LeagueSettings } from './LeagueSettings';
import { RankingsImport } from './RankingsImport';
import { DraftFile } from './DraftFile';
import { adviseOnBid, adviseOnNomination, buildAlerts } from '@/services/draftAdvisor';
import { openDraftSync } from '@/services/draftSync';
import type { LeagueShape } from '@/lib/valuation';
import type { RankingOverride } from '@/lib/rankingsCsv';
import '@/styles/draft-room.css';

interface DraftRoomProps {
  draftService: AuctionDraftService;
}

type SortKey = 'rank' | 'value' | 'projected';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;

const SORTS: Record<SortKey, (a: Player, b: Player) => number> = {
  rank: (a, b) => a.adp - b.adp,
  value: (a, b) => b.estimatedValue - a.estimatedValue,
  projected: (a, b) => b.projectedPoints - a.projectedPoints,
};

export const DraftRoom = ({ draftService }: DraftRoomProps) => {
  const [players, setPlayers] = useState<Player[]>(() => draftService.getPlayers());
  const [teams, setTeams] = useState<Team[]>(() => draftService.getTeams());
  const [selected, setSelected] = useState<Player | null>(null);
  const [teamId, setTeamId] = useState('');
  const [bid, setBid] = useState('');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('ALL');
  const [sort, setSort] = useState<SortKey>('rank');
  const [profileOpen, setProfileOpen] = useState(false);
  const [resumed, setResumed] = useState(0);
  const [tableSort, setTableSort] = useState<TableSort>('rank');
  const [tableDescending, setTableDescending] = useState(false);
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [asidePanel, setAsidePanel] = useState<
    'budgets' | 'rosters' | 'market' | 'bargains' | 'plan'
  >('budgets');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [followedAt, setFollowedAt] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [cleared, setCleared] = useState(0);
  const { preferences, setView, toggleWatch, togglePin, clearPins, setAdvisor, setColumns } =
    useDraftPreferences();

  const sync = useCallback(() => {
    setPlayers(draftService.getPlayers());
    setTeams(draftService.getTeams());
  }, [draftService]);

  // Resume an interrupted draft, then quietly freshen injury status from ESPN.
  useEffect(() => {
    if (AuctionDraftService.hasSavedDraft()) {
      const restored = draftService.restore();
      setResumed(restored);
      if (restored) sync();
    }
    void refreshIdentity().then((count) => {
      if (count) sync();
    });
  }, [draftService, sync]);

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return players
      .filter((player) => !player.isDrafted)
      .filter((player) => position === 'ALL' || player.position === position)
      .filter((player) => !watchedOnly || preferences.watchlist.includes(player.id))
      .filter((player) => {
        if (!needle) return true;
        const identity = getIdentity(player.id);
        return (
          player.name.toLowerCase().includes(needle) ||
          player.team.toLowerCase().includes(needle) ||
          (identity?.name ?? '').toLowerCase().includes(needle)
        );
      })
      .sort(SORTS[sort]);
  }, [players, query, position, sort, watchedOnly, preferences.watchlist]);

  const drafted = useMemo(
    () =>
      players
        .filter((player) => player.isDrafted)
        .sort((a, b) => (b.pickNumber ?? 0) - (a.pickNumber ?? 0)),
    [players]
  );

  const analytics: DraftAnalytics | null = useMemo(() => {
    if (!selected) return null;
    try {
      return draftService.getPlayerAnalytics(selected.id, teamId || 'team-1');
    } catch {
      return null;
    }
  }, [selected, teamId, draftService]);

  const check: BidCheck | null = useMemo(() => {
    if (!selected || !teamId) return null;
    return draftService.validateBid(selected.id, teamId, Number.parseInt(bid, 10));
  }, [selected, teamId, bid, draftService]);

  /**
   * Put a player on the block and hand the room straight to the money.
   *
   * Focus moves to the winning-team select because that is the next thing
   * anyone types: in a live auction the name is called, the bidding happens out
   * loud, and the only thing to record is who won and for how much.
   */
  const nominate = useCallback(
    (player: Player) => {
      setSelected(player);
      window.setTimeout(() => document.getElementById('dr-team')?.focus(), 0);
      let opening = player.estimatedValue;
      try {
        opening = Math.max(
          1,
          Math.round(draftService.getPlayerAnalytics(player.id, teamId || 'team-1').openingBid)
        );
      } catch {
        /* fall back to the list price */
      }
      setBid(String(opening));
    },
    [draftService, teamId]
  );

  const confirm = useCallback(() => {
    if (!selected || !teamId) return;
    if (!draftService.draftPlayer(selected.id, teamId, Number.parseInt(bid, 10))) return;
    sync();
    setSelected(null);
    setBid('');
    setProfileOpen(false);
  }, [selected, teamId, bid, draftService, sync]);

  const undo = useCallback(() => {
    if (draftService.undoLastPick()) sync();
  }, [draftService, sync]);

  /**
   * Clearing the draft is deliberate, and can be taken back.
   *
   * This button sits beside Undo and used to throw an afternoon's work away on
   * one click with nothing to recover it. The engine keeps the cleared pick log
   * aside, so the room can put it back until somebody drafts again.
   */
  const reset = useCallback(() => {
    draftService.resetDraft();
    setConfirmReset(false);
    setResumed(0);
    setSelected(null);
    setBid('');
    setCleared(draftService.clearedPickCount());
    sync();
  }, [draftService, sync]);

  const undoReset = useCallback(() => {
    draftService.restoreClearedDraft();
    setCleared(0);
    sync();
  }, [draftService, sync]);

  /**
   * A league change re-prices every player and rebuilds the teams, so the
   * selection, the bid in progress and the resume notice all refer to a board
   * that no longer exists.
   */
  const applyLeague = useCallback(
    (next: LeagueShape) => {
      draftService.setLeagueShape(next);
      setLeagueOpen(false);
      setResumed(0);
      setSelected(null);
      setTeamId('');
      setBid('');
      sync();
    },
    [draftService, sync]
  );

  /**
   * Keep other windows of this draft in step.
   *
   * One person runs the auction while the room watches a board on a second
   * screen; both are this app, in the same browser, on the same storage. The
   * engine announces anything that reached storage and rebuilds from it when
   * another window says it moved — no draft state crosses the channel, so the
   * two screens cannot end up believing different things.
   */
  useEffect(() => {
    const channel = openDraftSync(() => {
      draftService.reloadFromStorage();
      // The selection may refer to a player another window has just bought.
      setSelected((current) =>
        current ? (draftService.getPlayers().find((p) => p.id === current.id) ?? null) : null
      );
      setFollowedAt((count) => count + 1);
      sync();
    });

    draftService.setChangeListener(channel.publish);
    return () => {
      draftService.setChangeListener(null);
      channel.close();
    };
  }, [draftService, sync]);

  // players and teams are the change signal, not inputs: the service holds the
  // state and hands out fresh arrays on every sync, which the rule cannot see
  // through a method call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const market = useMemo(() => draftService.getMarketState(), [draftService, players, teams]);
  const nominator = useMemo(
    () => draftService.getNominatingTeam(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rotates with each pick
    [draftService, players]
  );
  /**
   * Nobody has room for another player.
   *
   * Worth knowing about explicitly: without it the room goes on offering
   * hundreds of players nobody can buy and asking a full team to nominate.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const complete = useMemo(() => draftService.isComplete(), [draftService, players, teams]);

  const anyModalOpen =
    profileOpen ||
    resultsOpen ||
    boardOpen ||
    compareOpen ||
    leagueOpen ||
    importOpen ||
    confirmReset;

  /**
   * Run the auction without reaching for the mouse.
   *
   * An auction moves faster than a board of 628 cards can be clicked through:
   * a name is called, bids are shouted, and the commissioner has a couple of
   * seconds to record it. `/` puts the cursor in the search box and Enter puts
   * the top match on the block, which turns a nomination into three keystrokes
   * and a name.
   *
   * Shortcuts stay out of the way of typing: a key pressed inside an input,
   * select or textarea belongs to that field, and a modal owns the keyboard
   * while it is open.
   */
  useEffect(() => {
    const isTyping = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (anyModalOpen || isTyping(event.target)) return;

      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key.toLowerCase() === 'u' && draftService.canUndo()) {
        event.preventDefault();
        undo();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anyModalOpen, undo, draftService]);

  /**
   * An import re-prices the board but does not invalidate money already spent,
   * so unlike a league change it leaves the draft alone.
   */
  const applyRankings = useCallback(
    (overrides: Record<string, RankingOverride>) => {
      draftService.setCustomRankings(overrides);
      setImportOpen(false);
      sync();
    },
    [draftService, sync]
  );

  const clearRankings = useCallback(() => {
    draftService.clearCustomRankings();
    setImportOpen(false);
    sync();
  }, [draftService, sync]);

  // Re-read on every sync: a league change replaces the teams array, which is
  // the signal that these numbers moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const league = useMemo(() => draftService.getLeagueShape(), [draftService, teams]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const customCount = useMemo(() => draftService.getCustomRankingCount(), [draftService, players]);

  const activeTeam = teams.find((team) => team.id === teamId);

  // The opinion layer is computed only when it is switched on: it is the one
  // part of the app that is not a measurement, and it should cost nothing when
  // nobody has asked for it.
  const advice = useMemo(
    () =>
      preferences.advisor && selected
        ? adviseOnBid(selected, activeTeam, analytics, draftService, Number.parseInt(bid, 10) || 0)
        : null,
    [preferences.advisor, selected, activeTeam, analytics, draftService, bid]
  );

  const alerts = useMemo(
    () => (preferences.advisor ? buildAlerts(players, activeTeam, draftService) : []),
    [preferences.advisor, players, activeTeam, draftService]
  );

  const nominationAdvice = useMemo(() => {
    if (!preferences.advisor) return null;
    const suggestion = adviseOnNomination(players, activeTeam, draftService);
    return suggestion
      ? {
          name: getIdentity(suggestion.player.id)?.name ?? suggestion.player.name,
          reason: suggestion.reason,
        }
      : null;
  }, [preferences.advisor, players, activeTeam, draftService]);

  const spent = teams.reduce((total, team) => total + team.spent, 0);
  const progress = players.length ? (drafted.length / players.length) * 100 : 0;
  const { season } = snapshotMeta();

  return (
    <div className="draft-room">
      <header className="dr-topbar">
        <h1 className="dr-wordmark">
          Draft<span>Vault</span>
        </h1>

        <div className="dr-stat">
          <span className="dr-eyebrow">Picks</span>
          <span className="dr-stat-value">
            {drafted.length}
            <span style={{ color: 'var(--dr-ink-faint)' }}>/{players.length}</span>
          </span>
        </div>

        <div
          className="dr-progress"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="dr-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="dr-stat">
          <span className="dr-eyebrow">Committed</span>
          <span className="dr-stat-value" style={{ color: 'var(--dr-value)' }}>
            ${spent}
          </span>
        </div>

        {followedAt > 0 && (
          <span
            className="dr-synced"
            key={followedAt}
            title="Another window of this draft made that change"
          >
            synced
          </span>
        )}

        <NominationClock
          nominator={nominator}
          player={selected}
          seconds={preferences.clockSeconds}
        />

        <button
          className="dr-button"
          onClick={undo}
          disabled={!draftService.canUndo()}
          title="Undo the last pick — or press u"
        >
          Undo pick
        </button>
        <button className="dr-button" onClick={() => setBoardOpen(true)} disabled={!drafted.length}>
          The room
        </button>
        <button
          className="dr-button"
          aria-pressed={preferences.advisor}
          onClick={() => setAdvisor(!preferences.advisor)}
          title="An opinion layer, kept separate from the numbers"
        >
          Advisor {preferences.advisor ? 'on' : 'off'}
        </button>
        <button
          className="dr-button"
          onClick={() => setResultsOpen(true)}
          disabled={!drafted.length}
        >
          Results
        </button>
        <button
          className="dr-button"
          aria-pressed={customCount > 0}
          onClick={() => setImportOpen(true)}
          title="Use your own rankings instead of ours"
        >
          {customCount > 0 ? `Your ranks (${customCount})` : 'Import ranks'}
        </button>
        <button
          className="dr-button"
          onClick={() => setLeagueOpen(true)}
          title="Teams, budget and roster shape — every price is computed from them"
        >
          {league.teams} × ${league.budget}
        </button>
        <button
          className="dr-button"
          onClick={() => setFileOpen(true)}
          title="Save the draft to a file, or load one"
        >
          File
        </button>
        <button
          className="dr-button"
          onClick={() => setConfirmReset(true)}
          disabled={!drafted.length}
        >
          Reset
        </button>
      </header>

      {resumed > 0 && (
        <p
          className="dr-ticker"
          role="status"
          style={{ color: 'var(--dr-ink-muted)', fontSize: 12 }}
        >
          Resumed your saved draft — {resumed} pick{resumed === 1 ? '' : 's'} restored.
        </p>
      )}

      {cleared > 0 && (
        <p className="dr-ticker dr-ticker-warn" role="status">
          Cleared {cleared} pick{cleared === 1 ? '' : 's'}.{' '}
          <button type="button" className="dr-linkish" onClick={undoReset}>
            Put them back
          </button>{' '}
          — available until somebody drafts again.
        </p>
      )}

      <div className="dr-body">
        <main aria-label="Available players">
          <div className="dr-toolbar">
            <input
              ref={searchRef}
              className="dr-search"
              placeholder="Search players or teams…  ( / )"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search players"
              onKeyDown={(event) => {
                // Enter puts the best remaining match on the block. Typing three
                // letters of a name and pressing return is the whole nomination.
                if (event.key === 'Enter' && available.length) {
                  event.preventDefault();
                  nominate(available[0]);
                  setQuery('');
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setQuery('');
                  event.currentTarget.blur();
                }
              }}
            />
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                className="dr-chip"
                aria-pressed={position === pos}
                onClick={() => setPosition(pos)}
              >
                {pos}
              </button>
            ))}
            {preferences.view === 'cards' && (
              <select
                className="dr-chip"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort players"
              >
                <option value="rank">By our rank</option>
                <option value="value">By value</option>
                <option value="projected">By projection</option>
              </select>
            )}

            <button
              type="button"
              className="dr-chip"
              aria-pressed={watchedOnly}
              onClick={() => setWatchedOnly((current) => !current)}
              title="Show only players you are watching"
            >
              ★ {preferences.watchlist.length}
            </button>

            <div className="dr-segmented" role="group" aria-label="Board layout">
              <button
                type="button"
                aria-pressed={preferences.view === 'cards'}
                onClick={() => setView('cards')}
              >
                Cards
              </button>
              <button
                type="button"
                aria-pressed={preferences.view === 'table'}
                onClick={() => setView('table')}
              >
                Table
              </button>
            </div>
          </div>

          {available.length === 0 ? (
            <p className="dr-empty dr-panel">
              No players match that filter.
              {query && ' Try clearing the search.'}
            </p>
          ) : preferences.view === 'table' ? (
            <PlayerTable
              players={available}
              selectedId={selected?.id}
              watchlist={preferences.watchlist}
              sort={tableSort}
              descending={tableDescending}
              onSort={(next) => {
                // Clicking the active column flips direction; a new column starts
                // in the direction that puts the best players first.
                if (next === tableSort) setTableDescending((current) => !current);
                else {
                  setTableSort(next);
                  setTableDescending(next !== 'rank' && next !== 'bye' && next !== 'name');
                }
              }}
              onSelect={nominate}
              onToggleWatch={toggleWatch}
              onTogglePin={togglePin}
              pinned={preferences.pinned}
              columns={preferences.columns}
              onColumns={setColumns}
            />
          ) : (
            <div className="dr-grid">
              {available.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  selected={selected?.id === player.id}
                  watched={preferences.watchlist.includes(player.id)}
                  onSelect={nominate}
                  onToggleWatch={toggleWatch}
                  onTogglePin={togglePin}
                  pinned={preferences.pinned.includes(player.id)}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="dr-aside">
          {complete ? (
            <section className="dr-stage dr-stage-done" aria-label="Draft complete">
              <h2 className="dr-stage-name" style={{ fontSize: 24 }}>
                That is the draft
              </h2>
              <p className="dr-meter-note">
                Every roster is full — {drafted.length} pick
                {drafted.length === 1 ? '' : 's'}, ${spent} spent. Nobody has room for another
                player, so there is nothing left to nominate.
              </p>
              <div className="dr-results-actions">
                <button
                  type="button"
                  className="dr-button dr-button-primary"
                  onClick={() => setResultsOpen(true)}
                >
                  See the results
                </button>
                <button type="button" className="dr-button" onClick={() => setBoardOpen(true)}>
                  The room
                </button>
              </div>
            </section>
          ) : (
            <NominationStage
              player={selected}
              teams={teams}
              teamId={teamId}
              bid={bid}
              analytics={analytics}
              check={check}
              onTeamChange={setTeamId}
              onBidChange={setBid}
              onConfirm={confirm}
              onOpenProfile={() => setProfileOpen(true)}
              canDraft={(team) => draftService.canDraft(team)}
            />
          )}
          {preferences.advisor && (
            <AdvisorPanel
              advice={advice}
              alerts={alerts}
              nomination={nominationAdvice}
              onDismiss={() => setAdvisor(false)}
            />
          )}

          <div className="dr-segmented dr-aside-tabs" role="group" aria-label="Side panel">
            {(['budgets', 'rosters', 'market', 'bargains', 'plan'] as const).map((panel) => (
              <button
                key={panel}
                type="button"
                aria-pressed={asidePanel === panel}
                onClick={() => setAsidePanel(panel)}
              >
                {panel}
              </button>
            ))}
          </div>

          {asidePanel === 'budgets' && <BudgetRail teams={teams} activeTeamId={teamId} />}
          {asidePanel === 'rosters' && (
            <TeamsPanel
              teams={teams}
              players={players}
              activeTeamId={teamId}
              onSelectTeam={setTeamId}
            />
          )}
          {asidePanel === 'market' && <MarketPanel market={market} teams={teams} />}
          {asidePanel === 'bargains' && (
            <BargainBoard service={draftService} players={players} onSelect={nominate} />
          )}
          {asidePanel === 'plan' && (
            <BudgetPlanner
              service={draftService}
              team={activeTeam}
              player={selected}
              bid={bid}
              players={players}
            />
          )}
        </aside>
      </div>

      <footer className="dr-ticker" aria-label="Recent picks">
        <span className="dr-eyebrow" style={{ flex: 'none' }}>
          {season ? `${season} pool` : 'Pool'}
        </span>
        {drafted.length === 0 ? (
          <span style={{ color: 'var(--dr-ink-faint)', fontSize: 12 }}>No picks yet.</span>
        ) : (
          drafted.slice(0, 12).map((player) => (
            <span className="dr-pick" key={player.id}>
              <strong>{getIdentity(player.id)?.name ?? player.name}</strong>
              {teams.find((team) => team.id === player.draftedBy)?.name}
              <span className="dr-num">${player.draftCost}</span>
            </span>
          ))
        )}
      </footer>

      <CompareTray
        players={players}
        pinned={preferences.pinned}
        onUnpin={togglePin}
        onClear={clearPins}
        onOpen={() => setCompareOpen(true)}
      />

      {compareOpen && (
        <CompareView
          players={players}
          pinned={preferences.pinned}
          onClose={() => setCompareOpen(false)}
          onUnpin={togglePin}
        />
      )}

      {boardOpen && (
        <DraftBoard
          service={draftService}
          players={players}
          teams={teams}
          onClose={() => setBoardOpen(false)}
        />
      )}

      {resultsOpen && (
        <DraftResults players={players} teams={teams} onClose={() => setResultsOpen(false)} />
      )}

      {importOpen && (
        <RankingsImport
          players={players}
          activeCount={customCount}
          onImport={applyRankings}
          onClear={clearRankings}
          onClose={() => setImportOpen(false)}
        />
      )}

      {fileOpen && (
        <DraftFile
          service={draftService}
          draftedCount={drafted.length}
          onLoaded={() => {
            setSelected(null);
            setTeamId('');
            setBid('');
            setResumed(0);
            setCleared(0);
            sync();
          }}
          onClose={() => setFileOpen(false)}
        />
      )}

      {confirmReset && (
        <div className="dr-modal" role="dialog" aria-modal="true" aria-label="Clear the draft">
          <button
            type="button"
            className="dr-modal-scrim"
            aria-label="Keep the draft"
            onClick={() => setConfirmReset(false)}
          />
          <article className="dr-modal-panel dr-confirm">
            <h2 className="dr-stage-name" style={{ fontSize: 22 }}>
              Clear {drafted.length} pick{drafted.length === 1 ? '' : 's'}?
            </h2>
            <p className="dr-meter-note">
              Every roster goes back to empty and every budget back to full. You can put it back
              afterwards, but only until somebody drafts again.
            </p>
            <div className="dr-results-actions">
              <button type="button" className="dr-button dr-button-primary" onClick={reset}>
                Clear the draft
              </button>
              <button
                type="button"
                className="dr-button"
                autoFocus
                onClick={() => setConfirmReset(false)}
              >
                Keep drafting
              </button>
            </div>
          </article>
        </div>
      )}

      {leagueOpen && (
        <LeagueSettings
          league={league}
          poolLeague={draftService.getPoolLeagueShape()}
          draftedCount={drafted.length}
          poolDepth={draftService.getPoolDepth()}
          onApply={applyLeague}
          onClose={() => setLeagueOpen(false)}
        />
      )}

      {profileOpen && selected && (
        <PlayerProfile
          player={selected}
          analytics={analytics}
          players={players}
          replacement={draftService.getReplacementLevel(selected.position)}
          currentBid={Number.parseInt(bid, 10) || undefined}
          pinned={preferences.pinned.includes(selected.id)}
          onTogglePin={() => togglePin(selected.id)}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
};
