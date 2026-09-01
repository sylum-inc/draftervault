import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuctionDraftService,
  type BidCheck,
  type DraftAnalytics,
  type Player,
  type Team,
  type PositionPulse,
} from '@/services/auctionDraftService';
import { getIdentity, refreshIdentity, snapshotMeta } from '@/services/nflIdentity';
import { useDraftPreferences } from '@/hooks/use-draft-preferences';
import { useDraftServer } from '@/hooks/use-draft-server';
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
import { RosterPlanPanel } from './RosterPlanPanel';
import { SpendOutlook } from './SpendOutlook';
import { BargainBoard } from './BargainBoard';
import { AdvisorPanel } from './AdvisorPanel';
import { LeagueSettings } from './LeagueSettings';
import { RankingsImport } from './RankingsImport';
import { AuctionSheetImport } from './AuctionSheetImport';
import { DraftFile } from './DraftFile';
import { SnakeOrder } from './SnakeOrder';
import { ServerPanel } from './ServerPanel';
import {
  adviseOnBid,
  adviseOnNomination,
  adviseOnSnakePick,
  buildAlerts,
  readTheRoom,
} from '@/services/draftAdvisor';
import { openDraftSync } from '@/services/draftSync';
import type { LeagueShape } from '@/lib/valuation';
import type { RankingOverride } from '@/lib/rankingsCsv';
import { matchesSearch, searchable } from '@/lib/playerSearch';
import { copyTextToClipboard, saveTextFile } from '@/lib/saveFile';
import { primeResearch, researchGeneratedAt, researchMark } from '@/services/playerResearch';
import { primeHistory } from '@/services/playerHistory';
import { primeSchedule } from '@/services/nflSchedule';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';
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

/**
 * How loudly the app should say that the record is only in this browser.
 *
 * There is no server on the night: the draft is a pick log in one profile on
 * one laptop, and a cleared cache or a crashed tab takes the afternoon with it.
 * The counter exists because remembering to save is the thing that reliably
 * fails while an auction is running — but a warning that shouts from the first
 * pick is a warning nobody reads by the fortieth, so it earns its volume.
 *
 * The bands are picks rather than minutes, because picks are what would have to
 * be re-entered from memory. Under eight is a couple of nominations and reads
 * grey. Eight is most of a snake round and is worth a colour. Twenty is a
 * stretch of the night nobody could reconstruct from the table's paper.
 */
const exposureLevel = (picks: number): 'clear' | 'quiet' | 'warn' | 'urgent' =>
  picks === 0 ? 'clear' : picks < 8 ? 'quiet' : picks < 20 ? 'warn' : 'urgent';

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
  /* `plan` is the roster plan and opens by default: it is the only panel that
     answers what to do with the whole budget, and every other reading in the
     room is a fragment of it. The budget *planner* — what one bid leaves
     behind — is `budget`, renamed out of its way. */
  const [asidePanel, setAsidePanel] = useState<
    'plan' | 'spend' | 'budget' | 'budgets' | 'rosters' | 'market' | 'bargains'
  >('plan');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  /**
   * Whether anybody has ever confirmed what league this is.
   *
   * With nothing stored the board prices at the league the pool was built for —
   * full PPR, no flex, because that is what the source data scores. It is a
   * valid league and almost certainly not this one, and every number on every
   * card comes from it. So the first run asks before a dollar is bid, rather
   * than letting a whole auction happen under somebody else's rules.
   */
  const [leagueConfirmed, setLeagueConfirmed] = useState(() =>
    AuctionDraftService.hasStoredLeague()
  );
  const [importOpen, setImportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetOnly, setSheetOnly] = useState(false);
  const [followedAt, setFollowedAt] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  /** Bumped whenever a copy of the draft actually leaves this browser. */
  const [savedTick, setSavedTick] = useState(0);
  const [handoff, setHandoff] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;
  const [cleared, setCleared] = useState(0);
  const { preferences, setView, toggleWatch, togglePin, clearPins, setAdvisor, setColumns } =
    useDraftPreferences();

  /**
   * The optional server, if there is one.
   *
   * With nothing configured this subscribes to nothing and calls nothing — the
   * hook's whole first job is to be free when the app is being run the way it
   * has always been run. The button below just says "Server" in that state and
   * the panel behind it explains that there is none, which is not a fault.
   */
  const server = useDraftServer(draftService);
  const serverLabel =
    server.discovery.state === 'ready'
      ? server.binding
        ? `Server · backing up`
        : `Server · on`
      : 'Server';

  const sync = useCallback(() => {
    setPlayers(draftService.getPlayers());
    setTeams(draftService.getTeams());
  }, [draftService]);

  /**
   * Point the selection back at the live player object.
   *
   * Importing a ranking or a sheet goes through `repriceInPlace`, which rebuilds
   * every player from the pool — so the selected object becomes an orphan still
   * carrying its pre-import price. The nomination stage, which is the one panel
   * a bid is actually decided from, then showed the old list price and the old
   * adjusted price while the board a few inches away showed the new ones. The
   * second window already re-resolves for the same reason.
   */
  const resync = useCallback(() => {
    setSelected((current) =>
      current ? (draftService.getPlayers().find((p) => p.id === current.id) ?? null) : null
    );
    sync();
  }, [draftService, sync]);

  // Resume an interrupted draft, then quietly freshen injury status from ESPN.
  useEffect(() => {
    if (AuctionDraftService.hasSavedDraft()) {
      const restored = draftService.restore();
      setResumed(restored);
      if (restored) sync();
    }
    // Strictly after the resume: an empty browser gets the sheet and the market
    // board this build is for, and a browser holding an afternoon's work gets
    // nothing done to it. `seedHomeDefaults` refuses on its own if anything is
    // stored, but the order is what makes that refusal reachable.
    if (draftService.seedHomeDefaults()) sync();
    void refreshIdentity().then((count) => {
      if (count) sync();
    });
  }, [draftService, sync]);

  /**
   * One searchable string per player, built once rather than on every keystroke.
   * The board re-filtered 628 players on each character typed, lowercasing every
   * name as it went.
   */
  const searchKeys = useMemo(() => {
    const keys = new Map<string, string>();
    for (const player of players) {
      const identity = getIdentity(player.id);
      keys.set(player.id, searchable(`${player.name} ${identity?.name ?? ''} ${player.team}`));
    }
    return keys;
  }, [players]);

  const available = useMemo(() => {
    const needle = searchable(query.trim());
    return (
      players
        .filter((player) => !player.isDrafted)
        .filter((player) => position === 'ALL' || player.position === position)
        .filter((player) => !watchedOnly || preferences.watchlist.includes(player.id))
        // Everything the money is actually buying. Off the sheet is a snake pick,
        // which is a different question from what is left on the board.
        .filter((player) => !sheetOnly || player.onSheet)
        .filter((player) => matchesSearch(searchKeys.get(player.id) ?? '', needle))
        .sort(SORTS[sort])
    );
  }, [players, query, position, sort, watchedOnly, sheetOnly, preferences.watchlist, searchKeys]);

  /**
   * How many cards to actually mount.
   *
   * The board is 628 players and React mounts every card it is given. Clearing
   * a search or switching back to ALL therefore built the whole list at once,
   * which froze the interface for seconds on an ordinary laptop — measured at
   * 4.3s to nominate under a 4x CPU throttle, which is draft night with a
   * browser full of tabs. Memoising the cards fixed re-renders but not this:
   * mounting is the cost.
   *
   * A page of sixty covers what anyone reads before searching, and scrolling
   * grows it, so nothing becomes unreachable.
   */
  const CARD_PAGE = 60;
  const [cardLimit, setCardLimit] = useState(CARD_PAGE);
  const moreRef = useRef<HTMLDivElement>(null);

  // The research marks are read straight out of a module-level map by each
  // card, so this flag is the only thing that tells the memoised board the map
  // has arrived. It flips once, which costs exactly one re-render of the list.
  /**
   * The card that is turned over, and whether it has been raised.
   *
   * One at a time on purpose, and one state rather than two, because the two
   * are a sequence: a card is expanded only from its own back, and closing the
   * expansion has to land back on the card rather than on the board. Two
   * independent flags would let the pair reach states the interaction does not
   * have — expanded but not flipped, flipped somewhere the expansion is not.
   *
   * `from` is the cell the card occupied when it was raised, measured at the
   * click, so the lift animates out of the board rather than fading in at the
   * centre. Fading in at the centre is a modal, which is the thing this is
   * deliberately not.
   */
  const [open, setOpen] = useState<{
    id: string;
    expanded: boolean;
    from: { dx: number; dy: number; scale: number } | null;
  } | null>(null);
  const flippedId = open?.id ?? null;
  const expandedId = open?.expanded ? open.id : null;

  /**
   * Where a card sits on the board, as the transform that would put a centred
   * overlay back on top of it.
   *
   * Composed here rather than in the card, because the target is the overlay's
   * width — a thing the room decides and the card cannot know.
   */
  const originOf = (rect: DOMRect | undefined) => {
    if (!rect || typeof window === 'undefined') return null;
    const width = Math.min(1180, window.innerWidth * 0.94);
    return {
      dx: rect.left + rect.width / 2 - window.innerWidth / 2,
      dy: rect.top + rect.height / 2 - window.innerHeight / 2,
      // Never below a tenth: a lift that starts from nothing reads as a fade,
      // which is the one thing it must not read as.
      scale: Math.max(0.1, rect.width / width),
    };
  };

  const toggleFlip = useCallback((playerId: string) => {
    setOpen((current) =>
      current?.id === playerId ? null : { id: playerId, expanded: false, from: null }
    );
  }, []);

  const expandCard = useCallback((playerId: string, origin?: DOMRect) => {
    const from = originOf(origin);
    setOpen({ id: playerId, expanded: true, from });
  }, []);

  /* Closing the expansion lands on the back of the card it came from, which is
     where it was opened from. Two escapes to the board, and each one undoes
     exactly the step that was taken. */
  const closeExpanded = useCallback(() => {
    setOpen((current) => (current ? { ...current, expanded: false, from: null } : null));
  }, []);

  /* Escape closes the raised card and lands on its back, which is where it was
     opened from — through the shared stack, so nesting works by construction
     and a keystroke is answered by whichever dialog registered last. */
  useDismissOnEscape(closeExpanded, Boolean(expandedId));

  /* Off the whole pool rather than off the filtered board, so a raised card
     survives the search box being typed in behind it. Closing on a filter
     change would throw away what somebody was reading because they reached for
     the keyboard. */
  /*
   * The most the man on the block is worth, solved rather than guessed.
   *
   * Memoised on the player and the pick count because it is a knapsack over the
   * whole sheet — about forty milliseconds — and the answer only moves when the
   * board does. Deliberately *not* computed for every card: sixty of these
   * would be two and a half seconds, and the number is only ever needed for the
   * player money is actually being decided about.
   */
  /*
   * Exactly one of the two, never both.
   *
   * Each is a knapsack over the whole sheet and the bounded form is two of
   * them, so computing the point estimate as well would be a third solve whose
   * answer is never shown — about forty wasted milliseconds on the one path
   * that runs while a name is being called.
   */
  const { walkAway, walkAwayBounds } = useMemo(() => {
    if (!selected) return { walkAway: null, walkAwayBounds: null };
    const bounds = draftService.maxPriceBounds(selected.id);
    return bounds
      ? { walkAway: null, walkAwayBounds: bounds }
      : { walkAway: draftService.maxPriceFor(selected.id), walkAwayBounds: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, players, draftService]);

  const expandedPlayer = useMemo(
    () => (expandedId ? (players.find((entry) => entry.id === expandedId) ?? null) : null),
    [expandedId, players]
  );

  const [researchReady, setResearchReady] = useState(false);
  useEffect(() => {
    let live = true;
    void primeResearch().then(() => live && setResearchReady(true));
    return () => {
      live = false;
    };
  }, []);

  /*
   * The same bargain for the three-season history, which the cards draw a
   * season's shape from.
   *
   * It is 750 KB and it is deliberately not paid for on first paint — the board
   * is usable the moment it renders and the sparklines arrive a beat later.
   * Read synchronously out of a module cache by each card for the reason the
   * research marks are: an array prop per card would be a new reference on
   * every render and would defeat the memo the board's performance rests on.
   */
  const [historyReady, setHistoryReady] = useState(false);
  useEffect(() => {
    let live = true;
    void primeHistory().then(() => live && setHistoryReady(true));
    return () => {
      live = false;
    };
  }, []);

  /*
   * And the season, which the back of a card draws the eighteen weeks from.
   *
   * One file for all thirty-two clubs, so priming it costs exactly what opening
   * one profile already cost — and the flag is deliberately not wired into a
   * re-render: nothing on the *front* of a card reads it, so a repaint on
   * arrival would re-render sixty cards to change nothing. The back is built
   * fresh whenever a card is turned over, which is always after this lands.
   */
  useEffect(() => {
    void primeSchedule();
  }, []);

  // Any change to what is being shown starts the list again from the top.
  useEffect(() => {
    setCardLimit(CARD_PAGE);
  }, [
    query,
    position,
    sort,
    watchedOnly,
    // The sheet chip changes the list like any other filter; leaving it out
    // leaves the paging window wherever the last list had scrolled to.
    sheetOnly,
    preferences.view,
    tableSort,
    tableDescending,
  ]);

  useEffect(() => {
    const sentinel = moreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCardLimit((current) => current + CARD_PAGE);
        }
      },
      // Grow a little before the sentinel is actually on screen, so scrolling
      // never stalls waiting for the next page.
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [available.length, cardLimit]);

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
    // `players` is a dependency because a reprice replaces the whole array
    // without the selection changing identity, and the analytics behind it move
    // with the prices.
  }, [selected, teamId, draftService, players]);

  /**
   * Which half of the draft the room is in.
   *
   * Derived from the pick log and the sheet on every sync rather than held in
   * state, so following another window, replaying a file and undoing across the
   * boundary all land on the same answer without any of them being told about
   * the phase. `players` is the change signal; the engine holds the state.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const phase = useMemo(() => draftService.getPhase(), [draftService, players]);
  const snake = phase === 'snake';

  const onTheClock = useMemo(
    () => draftService.getSnakeOnTheClock(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moves with every pick
    [draftService, players, teams]
  );

  /**
   * Sheet players still to sell or be passed over — and so how far the auction
   * has left to run. Null when no sheet is in force, which is the case with no
   * snake phase at all.
   */
  const sheetRemaining = useMemo(
    () => (draftService.getSheetCount() ? draftService.getSheetRemaining().length : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- counts down with the sheet
    [draftService, players]
  );

  const check: BidCheck | null = useMemo(() => {
    if (!selected) return null;
    // One typed answer, whichever half is running. The snake has no team to
    // choose — the order chose it — so the check is against whoever is up.
    if (snake) {
      return onTheClock ? draftService.validateSnakePick(selected.id, onTheClock.team.id) : null;
    }
    if (!teamId) return null;
    return draftService.validateBid(selected.id, teamId, Number.parseInt(bid, 10));
  }, [selected, teamId, bid, draftService, snake, onTheClock]);

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
      /*
       * The bid box in the auction, the confirm button in the snake.
       *
       * It used to hand focus to the winning-team select, which is the wrong
       * end of the transaction: the price is shouted *during* the bidding and
       * the winner is only known when it stops, so the information arrives in
       * the opposite order to the one the controls asked for. Typing the
       * running number as it climbs is also what keeps the competition readout
       * — who can still beat this — honest while the decision is live.
       *
       * Who won is now a click on the team row rather than a dropdown, so it
       * costs nothing to leave until the end.
       */
      window.setTimeout(() => {
        const target = (document.getElementById('dr-bid') ??
          document.getElementById('dr-snake-draft')) as HTMLElement | null;
        target?.focus();
        if (target instanceof HTMLInputElement) target.select();
      }, 0);
      // A snake pick has no price, so loading an opening bid for one puts a
      // number into `bid` that nothing on screen should be reading. The stage
      // hides the bid box, but the budget planner is handed the same value and
      // would otherwise offer to plan a $54 spend on a free pick.
      if (draftService.getPhase() === 'snake') {
        setBid('');
        return;
      }
      let opening = player.estimatedValue;
      try {
        opening = Math.max(
          1,
          Math.round(
            draftService.getPlayerAnalytics(player.id, teamIdRef.current || 'team-1').openingBid
          )
        );
      } catch {
        /* fall back to the list price */
      }
      setBid(String(opening));
    },
    // Deliberately not depending on teamId: this is handed to every card on the
    // board, and a new identity on each team change re-renders all of them.
    // The ref keeps the reading current without costing the memoisation.
    [draftService]
  );

  /**
   * Record the transaction, whichever half the room is in.
   *
   * One handler because the stage has one confirm button: in the auction it is
   * a sale at a price, in the snake it is a free pick by whoever the order says
   * is up. The engine re-checks both regardless of what got this far.
   */
  const confirm = useCallback(() => {
    if (!selected) return;
    if (snake) {
      if (!onTheClock) return;
      if (!draftService.draftSnakePick(selected.id, onTheClock.team.id)) return;
    } else {
      if (!teamId) return;
      if (!draftService.draftPlayer(selected.id, teamId, Number.parseInt(bid, 10))) return;
    }
    sync();
    setSelected(null);
    setBid('');
    setProfileOpen(false);
  }, [selected, teamId, bid, draftService, sync, snake, onTheClock]);

  /**
   * Nobody bid a dollar on the player on the block.
   *
   * Without this control one player the room never called holds the auction
   * open forever — `getSheetRemaining` never empties, the phase never turns,
   * and the app is still asking for a winning bid while the table has moved on
   * to round three. He is marked passed over rather than struck off, because
   * the sheet's length is the league's auctioned count.
   */
  const markUnsold = useCallback(() => {
    if (!selected) return;
    if (!draftService.removeFromSheet(selected.id)) return;
    setSelected(null);
    setBid('');
    sync();
  }, [selected, draftService, sync]);

  /**
   * The room came back to him after all.
   *
   * Passing a player over is not a pick, so undo cannot take it back — undo
   * pops the pick log and would remove an unrelated sale instead. Without this
   * the only route back was removing the whole sheet, which re-prices the board.
   */
  const returnToSheet = useCallback(() => {
    if (!selected) return;
    if (!draftService.returnToSheet(selected.id)) return;
    sync();
  }, [selected, draftService, sync]);

  const undo = useCallback(() => {
    if (draftService.undoLastPick()) sync();
  }, [draftService, sync]);

  /**
   * Put back the pick the last undo took away.
   *
   * Undo sits under one key next to the one that focuses the search, and two
   * accidental presses used to lose two picks with nothing on screen to say
   * which. The engine keeps them until somebody drafts again, which is the same
   * rule the cleared-draft net lives by.
   */
  const redo = useCallback(() => {
    const outcome = draftService.redoLastUndo();
    if (!outcome) return;
    // Always sync, even on a refusal: the pick has left the stack either way,
    // so the count on the button is wrong until the room re-reads it.
    sync();
    setHandoff(
      outcome.ok
        ? { tone: 'ok', text: `Put ${outcome.player.name} back.` }
        : { tone: 'bad', text: outcome.reason }
    );
  }, [draftService, sync]);

  /**
   * Hand the whole draft over as a file, and record that it left.
   *
   * The room's only backup is a copy somewhere that is not this browser
   * profile, so the act that makes one is also the act that resets the
   * exposure counter — wired to the outcome rather than to the click, because a
   * save the viewer declined is not a save.
   */
  const saveDraftFile = useCallback(
    async (prefix = ''): Promise<boolean> => {
      if (!draftService.getHistory().length) return false;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      // Taken before the await, and stamped after it. A save is not
      // instantaneous — the artifact's downloads capability puts a confirmation
      // in front of a person — and stamping the log as it stands afterwards
      // marked any pick recorded during the save as one that had left the
      // browser. The mark has to describe the text that went out.
      const snapshot = draftService.snapshotMark();
      const outcome = await saveTextFile(
        `draft-vault-${stamp}.json`,
        draftService.exportDraft(),
        'application/json'
      );
      // `handed-off` counts as the draft having left — it is the best evidence
      // an ordinary browser can give — but it is not reported as a saved file,
      // because a cancelled Save-As dialog looks exactly like a successful one
      // from here and a false "saved" is the one reassurance that costs an
      // afternoon.
      if (outcome.status === 'saved' || outcome.status === 'handed-off') {
        draftService.markExported('file', snapshot);
        setSavedTick((count) => count + 1);
        setHandoff({
          tone: 'ok',
          text:
            outcome.status === 'saved'
              ? `${prefix}Saved ${outcome.filename}.`
              : `${prefix}Handed ${outcome.filename} to your browser — check it downloaded.`,
        });
        return true;
      }
      setHandoff({
        tone: 'bad',
        text:
          outcome.status === 'declined'
            ? `${prefix}Nothing was saved — the save was declined.`
            : `${prefix}Could not save a file.`,
      });
      return false;
    },
    [draftService]
  );

  /**
   * The one-keystroke escape: the whole draft onto the clipboard.
   *
   * The same text a file carries, so what is pasted into a message or a note
   * loads straight back through the file panel. The clipboard is not permitted
   * everywhere — an insecure origin, a sandbox, a browser that asks — so a
   * refusal falls through to the file rather than failing quietly, which is the
   * one thing a backup must never do.
   */
  const copyDraft = useCallback(async () => {
    if (!draftService.getHistory().length) return;
    const snapshot = draftService.snapshotMark();
    if (await copyTextToClipboard(draftService.exportDraft())) {
      draftService.markExported('clipboard', snapshot);
      setSavedTick((count) => count + 1);
      setHandoff({
        tone: 'ok',
        text: 'The whole draft is on the clipboard — paste it somewhere that is not this browser.',
      });
      return;
    }
    await saveDraftFile('The clipboard is not available here, so ');
  }, [draftService, saveDraftFile]);

  // The note is about something that just happened, so it stops being true.
  useEffect(() => {
    if (!handoff) return;
    const timer = window.setTimeout(() => setHandoff(null), 6000);
    return () => window.clearTimeout(timer);
  }, [handoff]);

  /**
   * How far the record is from the last copy of it that left this browser.
   *
   * `players` is the change signal for a pick and `savedTick` for a save; the
   * engine holds both facts and is re-read rather than mirrored.
   */
  /**
   * What the man on the block gains over the free alternative at his position.
   *
   * Recomputed on every pick because both halves of it move: the auction takes
   * players off the sheet and the snake pool shrinks behind them.
   */
  /**
   * Bounded across every draw when the order has not been drawn yet.
   *
   * The stage is where a bid is decided, so a gain only the plan panel can show
   * is a gain nobody has at the moment a name is called. Null once an order
   * exists, because then there is one true number and a range beside it would
   * be noise.
   */
  /**
   * The live half of every card, recomputed on a pick and *stabilised*.
   *
   * Six objects serve sixty cards, because every reading in them is about a
   * position rather than a player. The stabilising is the part that matters:
   * `getPositionPulse` returns fresh objects each call, and handing a fresh
   * object to a memoised card defeats the memo — which would re-render the
   * whole board on every pick, the exact cost the board was measured and fixed
   * for once.
   *
   * So the previous map is kept and an entry is replaced only when its contents
   * actually differ. Buying a running back re-renders the running backs and
   * leaves the receivers alone.
   *
   * Compared by serialising rather than field by field: the shape is small,
   * flat and entirely numbers, a hand-written comparison would be one `&&` away
   * from silently pinning a stale shelf on screen for the rest of the night,
   * and the failure would look like the instrument simply not working.
   */
  const pulseRef = useRef(new Map<string, PositionPulse>());
  const pulse = useMemo(() => {
    const next = draftService.getPositionPulse();
    const held = pulseRef.current;
    const stable = new Map<string, PositionPulse>();
    for (const [position, reading] of next) {
      const previous = held.get(position);
      stable.set(
        position,
        previous && JSON.stringify(previous) === JSON.stringify(reading) ? previous : reading
      );
    }
    pulseRef.current = stable;
    return stable;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
  }, [draftService, players]);

  /**
   * What every player on the board buys over the snake, computed once.
   *
   * Per card this would be a market sort apiece — sixty of them on every
   * render, which is the cost the board was measured and fixed for once. The
   * outlook is the same for all of them, so the engine builds it a single time
   * and each card is handed three primitives off the result. Primitives are
   * what keeps the card memo intact: an object would be a new reference every
   * render and would re-render the whole board on every pick.
   */
  const boardGains = useMemo(
    () => draftService.getBoardGains(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [draftService, players]
  );

  const snakeBounds = useMemo(
    () =>
      selected && !draftService.hasSnakeOrder()
        ? draftService.gainOverSnakeBounds(selected.id)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [draftService, selected, players]
  );

  const snakeGain = useMemo(
    () => (selected ? draftService.gainOverSnake(selected.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [draftService, selected, players]
  );

  /**
   * What the web said about the man the snake would hand you instead.
   *
   * The join the room was missing. `snakeGain` is a difference against one
   * named player and the model knows only what he has done; the research file
   * knew that the free back was under an NFL review and that the free tight
   * end tore an Achilles in January, and neither reached the number they move.
   */
  const freeManResearch = useMemo(
    () => {
      const id = snakeGain?.freeId ?? snakeBounds?.high.freeId ?? null;
      return id ? researchMark(id) : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- researchReady is when the file lands
    [snakeGain, snakeBounds, researchReady]
  );

  /** When to buy. Recomputed on every pick, since both terms move with one. */
  const endgameState = useMemo(
    () => draftService.getEndgame(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [draftService, players, teams]
  );

  const unsaved = useMemo(
    () => draftService.picksSinceExport(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftService, players, savedTick]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exportMark = useMemo(() => draftService.getExportMark(), [draftService, savedTick]);

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
      // Always recorded, even when the answer was "these defaults are right":
      // the point of the first-run gate is that somebody said so.
      draftService.confirmLeague();
      setLeagueConfirmed(true);
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

    // `addChangeListener` rather than `setChangeListener`: the latter clears
    // the Set, and the server autosave subscribes to the same one. Whichever
    // mounted second would have silently taken the other's slot — a television
    // that stopped following, or a backup that stopped being written, with
    // nothing on screen to say so.
    const unsubscribe = draftService.addChangeListener(channel.publish);
    return () => {
      unsubscribe();
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
    !leagueConfirmed ||
    importOpen ||
    // A modal missing from this is a modal that lets "/" and "u" through, so
    // typing into its paste box undoes picks.
    sheetOpen ||
    orderOpen ||
    serverOpen ||
    // The draft file panel, which the exposure chip deliberately routes you
    // into — so leaving it out let a stray "u" undo a pick behind the scrim,
    // on the one screen whose whole job is protecting the record.
    fileOpen ||
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
      } else if (event.key.toLowerCase() === 'r' && draftService.canRedo()) {
        // Beside undo, because it is the same act read backwards. Nothing else
        // in the room answers to r, s or c: the existing shortcuts are / and u,
        // and every modal takes the keyboard while it is open.
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyDraft();
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveDraftFile();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anyModalOpen, undo, redo, copyDraft, saveDraftFile, draftService]);

  /**
   * An import re-prices the board but does not invalidate money already spent,
   * so unlike a league change it leaves the draft alone.
   */
  const applyRankings = useCallback(
    (overrides: Record<string, RankingOverride>) => {
      draftService.setCustomRankings(overrides);
      setImportOpen(false);
      resync();
    },
    [draftService, resync]
  );

  /**
   * The board the backtest preferred, from the consensus already bundled.
   *
   * Deliberately does not close the panel, unlike an import: the coverage it
   * returns — how many of the 628 the market actually ranks — is the number
   * somebody needs to see, and closing over it would hide the one honest
   * caveat this board has.
   */
  const useConsensus = useCallback(() => {
    const coverage = draftService.applyConsensusBoard();
    resync();
    return coverage;
  }, [draftService, resync]);

  const clearRankings = useCallback(() => {
    draftService.clearCustomRankings();
    setImportOpen(false);
    resync();
  }, [draftService, resync]);

  /**
   * The sheet re-prices the board and leaves the draft alone.
   *
   * It changes what the money is buying, not what anybody is allowed to do, so
   * every pick already made stays legal — this is an import, like a ranking,
   * and not a league change.
   */
  const applySheet = useCallback(
    (ids: string[]) => {
      draftService.setAuctionSheet(ids);
      setSheetOpen(false);
      resync();
    },
    [draftService, resync]
  );

  const clearSheet = useCallback(() => {
    draftService.clearAuctionSheet();
    setSheetOpen(false);
    // The chip goes with the sheet; left on, it would filter the board down to
    // a list nobody can see any more.
    setSheetOnly(false);
    resync();
  }, [draftService, resync]);

  const previewSheet = useCallback(
    (ids: string[]) => draftService.previewSheet(ids),
    [draftService]
  );

  // Re-read on every sync: a league change replaces the teams array, which is
  // the signal that these numbers moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const league = useMemo(() => draftService.getLeagueShape(), [draftService, teams]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const customCount = useMemo(() => draftService.getCustomRankingCount(), [draftService, players]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sheet = useMemo(() => draftService.getAuctionSheet(), [draftService, players]);

  // The chip is only rendered while a sheet exists, but the filter always runs,
  // so anything that drops the sheet without going through the local Remove —
  // a second window removing it, a draft file loaded with no sheet in it —
  // leaves the board filtered with no visible control to switch it off. That is
  // the board showing sixty players and search finding nobody, mid-auction.
  useEffect(() => {
    if (!sheet.ids.length) setSheetOnly(false);
  }, [sheet.ids.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myTeamId = useMemo(() => draftService.getMyTeamId(), [draftService, teams]);

  // The commissioner's snake order, repaired against the current teams by the
  // engine on every read — so a rename or a league change cannot leave a team
  // out of the list the room drafts from.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snakeOrder = useMemo(() => draftService.getSnakeOrder(), [draftService, teams, followedAt]);

  /**
   * Reordering the snake leaves the draft alone.
   *
   * It changes no price and makes no pick already taken illegal — only who is
   * next — which is exactly why the order lives in its own storage key rather
   * than on the league, where applying it would clear the board.
   */
  const applyOrder = useCallback(
    (ids: string[]) => {
      draftService.setSnakeOrder(ids);
      setOrderOpen(false);
      sync();
    },
    [draftService, sync]
  );

  const activeTeam = teams.find((team) => team.id === teamId);

  /**
   * The team the advice is written for.
   *
   * Not `activeTeam`. That is whoever is selected in the winning-team box,
   * which is a *recording* control — it says who just bought a player, and it
   * lands on an opponent constantly through a normal auction. Advice computed
   * against it was advice about somebody else's roster holes and somebody
   * else's money, printed in a panel that reads as yours. `getMyTeamId` is the
   * one statement of whose side this app is on, and it is what the advisor
   * speaks for. With no team marked, the panel says so rather than guessing.
   */
  const myTeam = useMemo(() => teams.find((team) => team.id === myTeamId), [teams, myTeamId]);

  /**
   * The same pricing the stage uses, but for the owner's roster.
   *
   * `analytics` above is priced for whichever team is in the winning-team box,
   * because that is what the stage's max-bid tile is about. The advisor needs
   * the same arithmetic against our own holes and our own budget, so it gets
   * its own call rather than reading a number computed for somebody else.
   */
  const myAnalytics: DraftAnalytics | null = useMemo(() => {
    if (!selected || !myTeamId) return null;
    try {
      return draftService.getPlayerAnalytics(selected.id, myTeamId);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
  }, [selected, myTeamId, draftService, players]);

  // The opinion layer is computed only when it is switched on: it is the one
  // part of the app that is not a measurement, and it should cost nothing when
  // nobody has asked for it.
  const advice = useMemo(() => {
    if (!preferences.advisor || !selected) return null;
    // The snake asks a different question and gets a different answer. Both
    // come back as one `Advice`, so the panel needs no second prop: it is the
    // same register of claim either way, and it stays in the same dashed box.
    //
    // The snake half is the one place the advisor does not speak for the owner,
    // and that is not an oversight: a free pick belongs to whoever the order
    // says is on the clock, and advice about taking him is advice about that
    // team's slot. The panel names whose side it is on either way.
    return snake
      ? adviseOnSnakePick(selected, onTheClock?.team, players, draftService)
      : adviseOnBid(selected, myTeam, myAnalytics, draftService, Number.parseInt(bid, 10) || 0);
  }, [
    preferences.advisor,
    selected,
    myTeam,
    myAnalytics,
    draftService,
    bid,
    snake,
    onTheClock,
    players,
  ]);

  /**
   * What the room would plausibly pay for the player on the block.
   *
   * The estimate half of who-can-outbid-you. The legal ceilings beside it on
   * the stage are facts and are computed whether or not the advisor is on; this
   * is a guess about what opponents want, so it costs nothing until asked for.
   */
  const roomRead = useMemo(() => {
    if (!preferences.advisor || !selected) return null;
    return readTheRoom(selected, draftService, Number.parseInt(bid, 10) || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
  }, [preferences.advisor, selected, bid, draftService, players, teams]);

  const alerts = useMemo(
    () => (preferences.advisor ? buildAlerts(players, myTeam, draftService) : []),
    [preferences.advisor, players, myTeam, draftService]
  );

  /**
   * What to nominate, and what to keep off the block.
   *
   * The watchlist goes in because it is the only place the owner has actually
   * said which players they want, and "protect the ones you want" is
   * meaningless without it. It is a per-person preference rather than a shared
   * fact, which is exactly why it is passed in from here rather than read by
   * the advisor: the engine holds nothing of the kind.
   */
  const nominationPlan = useMemo(
    () =>
      preferences.advisor
        ? adviseOnNomination(players, myTeam, draftService, { watchlist: preferences.watchlist })
        : null,
    [preferences.advisor, players, myTeam, draftService, preferences.watchlist]
  );

  /**
   * Who can legally beat the bid on the table, and what everything costs at
   * tonight's prices. Facts, so they are computed whatever the advisor is doing.
   */
  const competition = useMemo(() => {
    if (!selected || snake) return null;
    return draftService.getBidCompetition(selected.id, Number.parseInt(bid, 10) || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
  }, [selected, bid, snake, draftService, players, teams]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- moves with every pick
  const adjust = useMemo(() => draftService.getPriceAdjuster(), [draftService, players, teams]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- moves with every pick
  const basis = useMemo(() => draftService.getInflationBasis(), [draftService, players, teams]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a tier empties on a pick
  const tierBreaks = useMemo(() => draftService.getTierBreaks(), [draftService, players]);

  /**
   * When each thing the board knows was last learned.
   *
   * None of these move during a draft, so this exists mainly to be computed
   * once. `researchReady` is in the dependencies and has to be: the research
   * file is a lazy import, nothing else here changes when it lands, and
   * without it this panel read "—" for the research row until the first pick
   * was made — which is a claim ("we have no research") rather than a gap.
   */
  const stamps = useMemo(
    () => ({
      market: draftService.getMarketSnapshot(),
      research: researchGeneratedAt(),
      pool: draftService.getPoolGeneratedAt(),
      identity: snapshotMeta().generatedAt || null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- players is the change signal
    [draftService, players, researchReady]
  );

  const spent = teams.reduce((total, team) => total + team.spent, 0);
  const progress = players.length ? (drafted.length / players.length) * 100 : 0;
  const { season } = snapshotMeta();

  return (
    <div className="draft-room">
      {/* Header and block stick together.
          The band was sticky at a fixed offset under a header that wraps —
          so at any width where the setup row wrapped, the block tucked itself
          underneath the header and the bid box was hidden by the thing meant
          to be above it. One sticky context has no offset to get wrong. */}
      <div className="dr-chrome">
        <header className="dr-topbar">
          {/* The progress bar is the bar's own bottom edge now.
            As a flex item it took `flex: 1` — three hundred-odd pixels of the
            one row every control has to fit on, to say something the "0/639"
            beside it already says exactly. As a hairline under the header it
            says the same thing, continuously, for two pixels. */}
          <div
            className="dr-progress"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="dr-progress-fill" style={{ width: `${progress}%` }} />
          </div>

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

          <div className="dr-stat">
            <span className="dr-eyebrow">Committed</span>
            <span className="dr-stat-value" style={{ color: 'var(--dr-value)' }}>
              ${spent}
            </span>
          </div>

          {/* Which half of the draft is running, and how far the auction has left
            to go. The count is the reason the unsold control exists: without a
            visible number, one player nobody called leaves the room wondering
            why the bid box will not go away. */}
          {sheetRemaining != null && (
            <div className="dr-stat">
              <span className="dr-eyebrow">{snake ? 'Snake' : 'Sheet left'}</span>
              <span className="dr-stat-value">
                {snake && onTheClock ? `#${onTheClock.overall}` : sheetRemaining}
              </span>
            </div>
          )}

          {followedAt > 0 && (
            <span
              className="dr-synced"
              key={followedAt}
              title="Another window of this draft made that change"
            >
              synced
            </span>
          )}

          {/* Nobody nominates in the snake — the order does it — so the clock
            would be naming a team for a turn that does not exist. The stage
            carries whose pick it is instead. */}
          {!snake && (
            <NominationClock
              nominator={nominator}
              player={selected}
              seconds={preferences.clockSeconds}
            />
          )}

          {/* Three groups, because fifteen identical pills in one wrapping row is
            a menu with the labels rubbed off. What the auction touches is
            solid; what is set up once is quiet; what destroys work sits alone
            at the end in the colour of the thing it does. */}
          <div className="dr-topbar-group dr-topbar-live">
            <button
              className="dr-button"
              onClick={undo}
              disabled={!draftService.canUndo()}
              title="Undo the last pick — or press u"
            >
              Undo pick
            </button>
            {/* Only while there is something to put back. An always-present Redo is
            a button that does nothing most of the night, and one that appears
            the moment a pick is taken back says what it is for. */}
            {draftService.canRedo() && (
              <button
                className="dr-button"
                onClick={redo}
                title="Put back the pick that was just undone — or press r"
              >
                Redo ({draftService.undoneCount()})
              </button>
            )}

            {/* How exposed the record is, where the picks are counted rather than
            inside a panel nobody opens mid-auction. It opens the file panel,
            because the fix for the thing it is warning about is in there. */}
            {drafted.length > 0 && (
              <button
                className="dr-exposure"
                data-level={exposureLevel(unsaved)}
                onClick={() => setFileOpen(true)}
                title={
                  unsaved === 0
                    ? `The whole draft has been ${exportMark?.kind === 'clipboard' ? 'copied' : 'saved'} since the last pick. Press s to save a file, c to copy it.`
                    : `${unsaved} pick${unsaved === 1 ? '' : 's'} since the draft last left this browser${exportMark ? '' : ' — no copy has ever been made'}. Press s to save a file, c to copy it.`
                }
              >
                {unsaved === 0 ? 'Copy kept' : `${unsaved} unsaved`}
              </button>
            )}
            <button
              className="dr-button"
              onClick={() => setBoardOpen(true)}
              disabled={!drafted.length}
            >
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
          </div>

          <div className="dr-topbar-group dr-topbar-setup">
            <button
              className="dr-button dr-button-ghost"
              aria-pressed={customCount > 0}
              onClick={() => setImportOpen(true)}
              title="Use your own rankings instead of ours"
            >
              {customCount > 0 ? `Your ranks (${customCount})` : 'Import ranks'}
            </button>
            <button
              className="dr-button dr-button-ghost"
              aria-pressed={sheet.ids.length > 0}
              onClick={() => setSheetOpen(true)}
              title="The commissioner's sheet — the players money actually buys"
            >
              {sheet.ids.length > 0 ? `Sheet (${sheet.ids.length})` : 'Auction sheet'}
            </button>
            <button
              className="dr-button dr-button-ghost"
              onClick={() => setLeagueOpen(true)}
              title="Teams, budget and roster shape — every price is computed from them"
            >
              {league.teams} × ${league.budget}
            </button>
            <button
              className="dr-button dr-button-ghost"
              onClick={() => setOrderOpen(true)}
              title="The order the snake is called in — the commissioner sets it"
            >
              Snake order
            </button>
            <button
              className="dr-button dr-button-ghost"
              onClick={() => setFileOpen(true)}
              title="Save the draft to a file, or load one"
            >
              File
            </button>
            <button
              className="dr-button dr-button-ghost"
              aria-pressed={server.discovery.state === 'ready'}
              onClick={() => setServerOpen(true)}
              title="Saved drafts and rebuilds, when a server is running. The app does not need one."
            >
              {serverLabel}
            </button>
          </div>

          <button
            className="dr-button dr-button-danger"
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

        {handoff && (
          <p
            className={handoff.tone === 'bad' ? 'dr-ticker dr-ticker-warn' : 'dr-ticker'}
            role="status"
            style={handoff.tone === 'bad' ? undefined : { color: 'var(--dr-value)', fontSize: 12 }}
          >
            {handoff.text}
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

        {/* The block, across the whole width.
          It lived in the 380px aside, where its own content is about nine
          hundred pixels tall — so the winning-team select, the bid box and
          SOLD, which are the entire mechanism of the night, sat below the fold
          of a sub-panel. Nothing else on this screen is a control somebody
          uses under time pressure, and the board underneath had 1100px to hold
          four cards. Sticky, so it stays put while the board scrolls. */}
        <div className="dr-band">
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
              mode={phase}
              myTeamId={myTeamId}
              walkAway={walkAway}
              walkAwayBounds={walkAwayBounds}
              /* The row asks the engine rather than guessing, so a chip that
                 looks live is a sale the engine will accept. Twelve cheap
                 lookups per render of one panel. */
              checkTeam={
                selected && phase === 'auction'
                  ? (candidate, amount) =>
                      draftService.validateBid(selected.id, candidate, amount || 1)
                  : undefined
              }
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
              onTheClock={onTheClock}
              snakeGain={snakeGain}
              snakeBounds={snakeBounds}
              freeManResearch={freeManResearch}
              sheetRemaining={sheetRemaining}
              onUnsold={markUnsold}
              onReturnToSheet={returnToSheet}
              passedOver={!!selected && sheet.unsold.includes(selected.id)}
              adjusted={selected && !snake ? adjust.price(selected) : null}
              inflation={adjust.inflation}
              competition={competition}
            />
          )}
        </div>
      </div>

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

            {sheet.ids.length > 0 && (
              <button
                type="button"
                className="dr-chip"
                aria-pressed={sheetOnly}
                onClick={() => setSheetOnly((current) => !current)}
                title="Show only the players being auctioned"
              >
                Sheet
              </button>
            )}

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
          ) : (
            <>
              {preferences.view === 'table' ? (
                <PlayerTable
                  players={available}
                  limit={cardLimit}
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
                  adjust={adjust}
                />
              ) : (
                <div className={`dr-grid${expandedId ? ' is-receded' : ''}`}>
                  {available.slice(0, cardLimit).map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      selected={selected?.id === player.id}
                      watched={preferences.watchlist.includes(player.id)}
                      onSelect={nominate}
                      onToggleWatch={toggleWatch}
                      onTogglePin={togglePin}
                      pinned={preferences.pinned.includes(player.id)}
                      researchReady={researchReady}
                      historyReady={historyReady}
                      gainLow={boardGains.get(player.id)?.low}
                      gainHigh={boardGains.get(player.id)?.high}
                      gainFree={boardGains.get(player.id)?.free}
                      gainSlot={boardGains.get(player.id)?.slot}
                      pulse={pulse.get(player.position)}
                      onFlip={toggleFlip}
                      /* Flipped in the grid; the raised copy is rendered once,
                         below, in its own layer. A card cannot be both, and
                         leaving the expansion here would have it grow inside a
                         cell — which is the layout this replaced. */
                      flipped={flippedId === player.id && !expandedId}
                      onExpand={expandCard}
                    />
                  ))}
                </div>
              )}
              {available.length > cardLimit && (
                <div ref={moreRef} className="dr-more" role="status">
                  {available.length - cardLimit} more — keep scrolling, or search for a name
                </div>
              )}

              {/* The raised card, in its own layer above the board.
                  Rendered here rather than inside the grid because a fixed,
                  centred overlay cannot be a grid child without the grid
                  reserving a cell for it — which is exactly the hole in the
                  row that the lift exists to avoid. The board behind is
                  dimmed and pushed back rather than replaced, so what closing
                  restores is the board that was there, unmoved. */}
              {expandedPlayer && (
                <div
                  className="dr-lift"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${expandedPlayer.name} dossier`}
                  onClick={closeExpanded}
                >
                  <PlayerCard
                    player={expandedPlayer}
                    selected={selected?.id === expandedPlayer.id}
                    watched={preferences.watchlist.includes(expandedPlayer.id)}
                    onSelect={nominate}
                    onToggleWatch={toggleWatch}
                    onTogglePin={togglePin}
                    pinned={preferences.pinned.includes(expandedPlayer.id)}
                    researchReady={researchReady}
                    historyReady={historyReady}
                    gainLow={boardGains.get(expandedPlayer.id)?.low}
                    gainHigh={boardGains.get(expandedPlayer.id)?.high}
                    gainFree={boardGains.get(expandedPlayer.id)?.free}
                    gainSlot={boardGains.get(expandedPlayer.id)?.slot}
                    pulse={pulse.get(expandedPlayer.position)}
                    onFlip={closeExpanded}
                    flipped
                    expanded
                    liftFrom={open?.from ?? undefined}
                    /* The dossier goes *into* the raised card, which is what
                       makes this a drilldown rather than a panel that appears
                       beside one. */
                    detail={
                      <PlayerProfile
                        inline
                        player={expandedPlayer}
                        analytics={selected?.id === expandedPlayer.id ? analytics : null}
                        currentBid={selected?.id === expandedPlayer.id ? Number(bid) || 0 : 0}
                        players={players}
                        replacement={draftService.getReplacementLevel(expandedPlayer.position)}
                        /* The league, so a season's points are restated the way
                           every other number in the room already is — the pool
                           file counts full PPR and this one is half. */
                        league={draftService.getLeagueShape()}
                        gain={boardGains.get(expandedPlayer.id)?.high ?? null}
                        gainFree={boardGains.get(expandedPlayer.id)?.free ?? null}
                        ceiling={pulse.get(expandedPlayer.position)?.myCeiling ?? null}
                        pinned={preferences.pinned.includes(expandedPlayer.id)}
                        onTogglePin={() => togglePin(expandedPlayer.id)}
                        onClose={closeExpanded}
                      />
                    }
                  />
                </div>
              )}
            </>
          )}
        </main>

        <aside className="dr-aside">
          {preferences.advisor && (
            <AdvisorPanel
              advice={advice}
              alerts={alerts}
              plan={nominationPlan}
              room={roomRead}
              /* Falling back to the owner when nobody is on the clock. At the
                 end of a hybrid draft getSnakeOnTheClock returns nothing, and
                 collapsing that into "no team is marked as yours" told the
                 owner to go and mark one while the alert directly beneath it
                 named their team. */
              speakingFor={
                snake ? (onTheClock?.team.name ?? myTeam?.name ?? null) : (myTeam?.name ?? null)
              }
              onDismiss={() => setAdvisor(false)}
            />
          )}

          <div className="dr-segmented dr-aside-tabs" role="group" aria-label="Side panel">
            {(['plan', 'spend', 'budget', 'budgets', 'rosters', 'market', 'bargains'] as const).map(
              (panel) => (
                <button
                  key={panel}
                  type="button"
                  aria-pressed={asidePanel === panel}
                  onClick={() => setAsidePanel(panel)}
                >
                  {panel}
                </button>
              )
            )}
          </div>

          {asidePanel === 'spend' && <SpendOutlook service={draftService} players={players} />}
          {asidePanel === 'budgets' && (
            <BudgetRail teams={teams} players={players} activeTeamId={teamId} myTeamId={myTeamId} />
          )}
          {asidePanel === 'rosters' && (
            <TeamsPanel
              teams={teams}
              players={players}
              activeTeamId={teamId}
              onSelectTeam={setTeamId}
              league={league}
              myTeamId={myTeamId}
            />
          )}
          {asidePanel === 'market' && (
            <MarketPanel
              market={market}
              teams={teams}
              phase={phase}
              basis={basis}
              tierBreaks={tierBreaks}
              endgame={endgameState}
              stamps={stamps}
            />
          )}
          {asidePanel === 'bargains' && (
            <BargainBoard service={draftService} players={players} onSelect={nominate} />
          )}
          {asidePanel === 'plan' && (
            <RosterPlanPanel service={draftService} players={players} onSelect={nominate} />
          )}
          {asidePanel === 'budget' && (
            <BudgetPlanner
              service={draftService}
              /* Yours, not whoever the winning-team select happens to sit on.
                 That select is a *recording* control — it names who just bought
                 a player, so through a normal auction it sits on an opponent
                 most of the night — and this panel answers "what does this bid
                 leave me". It was handed `activeTeam`, which is the same
                 mistake the advisor was found making, and it read "Team 9's
                 budget" on a screen whose owner is Team 1. `activeTeam` is
                 still the fallback, because with nobody marked as yours there
                 is no better answer than the team being recorded, and the
                 header names whichever it is. */
              team={myTeam ?? activeTeam}
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
              {/* A snake pick has no price. "$0" would read as a player bought
                  for nothing, which is a claim about money nobody spent. */}
              <span className="dr-num">
                {player.draftCost != null ? `$${player.draftCost}` : 'snake'}
              </span>
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
          onCorrected={(result) => {
            // A correction replays the whole log, so the selection may now be a
            // player who is on the board again — or gone from it — and the
            // count of what did not replay is the only place that is reported.
            resync();
            setSelected(null);
            setBid('');
            setHandoff(
              result.skipped
                ? {
                    tone: 'bad',
                    text: `Corrected. ${result.skipped} later pick${result.skipped === 1 ? '' : 's'} could no longer have happened and ${result.skipped === 1 ? 'was' : 'were'} dropped.`,
                  }
                : { tone: 'ok', text: `Corrected — all ${result.restored} picks still replay.` }
            );
          }}
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
          onUseConsensus={useConsensus}
          market={draftService.getMarketSnapshot()}
          onClose={() => setImportOpen(false)}
        />
      )}

      {sheetOpen && (
        <AuctionSheetImport
          players={players}
          activeCount={sheet.ids.length}
          unsoldCount={sheet.unsold.length}
          maxPrice={draftService.maxBiddablePrice()}
          preview={previewSheet}
          onApply={applySheet}
          onClear={clearSheet}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {orderOpen && (
        <SnakeOrder
          order={snakeOrder}
          myTeamId={myTeamId}
          pickCount={draftService.getSnakePickCount()}
          onApply={applyOrder}
          onClose={() => setOrderOpen(false)}
        />
      )}

      {fileOpen && (
        <DraftFile
          service={draftService}
          draftedCount={drafted.length}
          unsaved={unsaved}
          note={handoff}
          onSave={() => void saveDraftFile()}
          onCopy={() => void copyDraft()}
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

      {serverOpen && (
        <ServerPanel
          service={draftService}
          server={server}
          draftedCount={drafted.length}
          onLoaded={() => {
            setSelected(null);
            setTeamId('');
            setBid('');
            setResumed(0);
            setCleared(0);
            sync();
          }}
          onClose={() => setServerOpen(false)}
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

      {(leagueOpen || !leagueConfirmed) && (
        <LeagueSettings
          firstRun={!leagueConfirmed}
          league={league}
          poolLeague={draftService.getPoolLeagueShape()}
          draftedCount={drafted.length}
          poolDepth={draftService.getPoolDepth()}
          sheetSize={sheet.ids.length}
          teamList={teams}
          myTeamId={myTeamId}
          onRenameTeam={(id, name) => {
            draftService.renameTeam(id, name);
            sync();
          }}
          onSetMyTeam={(id) => {
            draftService.setMyTeam(id);
            sync();
          }}
          preview={(shape) => draftService.getPricePreview(shape)}
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
          league={draftService.getLeagueShape()}
          gain={boardGains.get(selected.id)?.high ?? null}
          gainFree={boardGains.get(selected.id)?.free ?? null}
          ceiling={pulse.get(selected.position)?.myCeiling ?? null}
          currentBid={Number.parseInt(bid, 10) || undefined}
          pinned={preferences.pinned.includes(selected.id)}
          onTogglePin={() => togglePin(selected.id)}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
};
