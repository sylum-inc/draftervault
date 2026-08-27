# Draft Vault — working notes

A fantasy football **auction draft room**. Pure front end: Vite + React + TypeScript,
no backend, no database, no API keys needed to run it.

## Commands

```sh
npm ci
npm run dev          # http://localhost:8080
npm run validate     # type-check + lint + tests
npm run test:run
npm run build && npm run serve   # production bundle on :4173
npm run build:single # one self-contained HTML file in dist-single/
npm run build:artifact  # that file, as a publishable Artifact fragment
npm run fetch:nfl    # regenerate team colors, crests and defensive units from ESPN
npm run build:pool   # rebuild the 628-player pool from nflverse production data
npm run build:icons  # redraw the app icons (CI checks they match)
docker compose up -d --build     # nginx on :8080
```

## Architecture

```
src/pages/Index.tsx
  └── components/draft-room/DraftRoom.tsx     layout, filters, draft flow
        ├── PlayerCard.tsx        board card: headshot, team color, tier
        ├── PlayerTable.tsx       dense sortable board for 628 players
        ├── NominationStage.tsx   player on the block + bid controls
        ├── NominationClock.tsx   whose turn, how long they have had
        ├── BudgetRail.tsx        money left per team
        ├── TeamsPanel.tsx        every roster and its open slots
        ├── MarketPanel.tsx       inflation, supply, what the room pays
        ├── PlayerProfile.tsx     seven tabs: overview, production, usage,
        │                         offence, career, schedule, value
        │                         (unit replaces production+usage for defenses)
        ├── CompareTray.tsx       pin 2-4 players, then compare on shared scales
        ├── DraftBoard.tsx        the room: 12x16 grid, money flow, tier depletion
        ├── BudgetPlanner.tsx     what a bid leaves behind, live
        ├── BargainBoard.tsx      our board against expert consensus
        ├── AdvisorPanel.tsx      the opinion layer, off by default
        ├── DraftFile.tsx         save the draft to a file, or load one
        ├── LeagueSettings.tsx    teams, budget, roster shape — re-prices the board
        ├── RankingsImport.tsx    bring your own values, previewed before applying
        ├── charts/               RangeBar, PercentileBars, SeasonMultiples,
        │                         ScheduleStrip, BidLadder, PositionSwarm,
        │                         OutcomeCurve, ConsensusRange, QuadrantScatter,
        │                         DraftFlow, TierDepletion, CareerArc
        ├── DraftResults.tsx      grades and export
        ├── Sparkline.tsx         one season, game by game
        └── Headshot.tsx          photo with monogram fallback

src/hooks/use-draft-preferences.ts    view, watchlist, queue, clock length

src/lib/valuation.ts                  league shape + points-to-dollars (shared)
src/lib/rankingsCsv.ts                parsing and matching an imported ranking
src/lib/saveFile.ts                   hands over a file, in browser or artifact
src/services/auctionDraftService.ts   the draft engine (rules, bidding, state)
src/services/draftAdvisor.ts          the opinion layer, deliberately separate
src/services/nflIdentity.ts           team colors, crests, headshots
src/services/draftSync.ts             tells other windows the draft moved
src/data/nfl/pool.json                628 players: projections, values (generated)
src/data/nfl/player-history.json      per-player season and weekly scoring (lazy)
src/data/nfl/schedule.json            2026 season by team, with matchup difficulty
src/data/nfl/team-context.json        per-offence pace, PROE, red-zone rate
scripts/build-player-pool.mjs         builds the pool from nflverse
scripts/fetch-nfl-data.mjs            builds team identity from ESPN
scripts/build-icons.mjs               draws public/icons/ with no image library
src/styles/draft-room.css             design tokens + component styles
```

**The draft engine owns the rules.** `validateBid()` returns a typed rejection the
UI renders verbatim; `draftPlayer()` re-checks it. Bids must be whole dollars ≥ 1,
within budget minus a $1 reserve per unfilled starting slot, and inside the
position and roster limits. Picks persist to `localStorage` and replay on load —
only the picks are stored, so derived numbers always come from current logic.

**The draft is the only shared fact.** Everything a second screen would need to
agree on lives in the engine and is derived from the pick log — including whose
turn it is to nominate, which is `draftedCount % teams.length` rather than
stored state. Per-person choices (board layout, watchlist, queue, clock length)
live in `use-draft-preferences` and would never need to synchronise. Keep that
line where it is; it is what makes a shared-view mode tractable later.

`getPlayers()` and `getTeams()` return **fresh arrays** deliberately. An earlier
interface handed back the same array reference and mutated it in place, so React
never saw a change and drafted players stayed on the board. Don't "optimize" that
back.

**Facts and opinions are different files.** Everything in `auctionDraftService`
and the pool reports an observation. `draftAdvisor.ts` takes a position — bid,
hold, walk away — and it is a separate module for that reason, off until asked
for, rendered in its own dashed box with the reasoning that produced each call.
Don't let a recommendation leak into `DraftAnalytics`.

**The league is one definition, not two.** `src/lib/valuation.ts` holds both the
league shape and the arithmetic that turns projected points into dollars. The
pool builder imports it through Node's type stripping (hence the pinned Node 22
in CI); the client imports it directly and re-prices from `projection.points`,
which is league-independent, rather than trusting the values baked into
pool.json. That is what lets a league the pool was never built for price
correctly with no regeneration. A test re-prices the shipped pool at the shape
it was built for and asserts all 628 auction values, VORPs and replacement
levels match exactly — that test is the guard against the two drifting, so
don't weaken it to a tolerance.

**A league change clears the draft; an import does not.** Bids were made against
prices a new league does not charge, so replaying them would build a roster
nobody could have bought — `restore()` refuses a save stamped with a different
league for the same reason. An imported ranking only changes what the players
still on the board are said to be worth, so a draft in progress survives it.

**An import may not guess.** The pool joins on ids the whole way, but a CSV
someone exports from a spreadsheet carries only names. `rankingsCsv.ts` keeps
the half of the rule that still applies: a name matching two players matches
neither and is reported as ambiguous. The shipped pool has 27 names that
collide on first-initial-plus-surname — "B. Robinson" is Bijan ($54) or Brian
(a bench back) — which is exactly what the old importer's `includes(lastName)`
bound silently and wrongly. Imported values replace ours everywhere including
in the advice, because an opinion nothing acts on is decoration; ours survives
on `player.modelValue` and the board marks whose number it is showing.

**Draft night is the deadline, and the room has to survive it.** Three things
were found by driving a full 192-pick draft rather than by testing one. Reset
sat beside Undo, took no confirmation, and deleted the pick log outright — it
now asks, and the engine keeps the cleared log so it can be put back until
somebody drafts again. `getNominatingTeam` rotated on `draftedCount %
teams.length` regardless of room, so a full team kept being asked to nominate;
it now steps over teams that cannot draft, and `isComplete()` ends the draft
rather than offering hundreds of players nobody can buy. A full team is
disabled in the winning-team list rather than accepted and rejected afterwards.

**The auction runs from the keyboard, because it moves faster than a mouse.**
`/` focuses the search, a few letters and Enter put the top match on the block,
focus lands on the winning-team select, and Enter in the bid sells. `u` undoes.
Shortcuts never fire inside an input, select or textarea, and a modal owns the
keyboard while open — the guard is what keeps typing "u" in the search box from
undoing a pick.

**A file is the escape hatch.** `exportDraft()`/`importDraft()` carry the pick
log _and_ the league, because prices are meaningless without the league they
were bid under. Loading replaces the board, so it asks first when a draft is in
progress, and picks that no longer validate are counted rather than dropped
quietly.

**A second window follows; it does not receive.** `draftSync.ts` posts one
thing on a `BroadcastChannel` — that the draft moved — and the receiving window
rebuilds from the same localStorage the sender just wrote. No draft state
crosses the channel, so two screens cannot come to believe different things; a
message that carried the change could arrive out of order and they would. This
is what the pick-log-is-the-only-shared-fact rule was being kept for. It is
same-browser only: a draft across twelve houses needs a server, and there
isn't one.

`persist()` announces on **every** path including the empty one. It used to
`return` early when the draft emptied, so a second window followed picks but
never followed an undo back to zero, a reset, or a league change — all three
land on that branch. Unit tests missed it because they called
`reloadFromStorage()` themselves; driving two real windows caught it.

**Identity is two-tiered.** The bundled snapshot in `src/data/nfl/` paints first
with real names, colors and faces and needs no network; `refreshIdentity()` then
merges live injury/team updates from ESPN over it and silently falls back to the
snapshot on any failure.

## Data provenance

Five free sources, joined on ids the whole way — no name matching anywhere:
**ESPN** for team colors, crests and headshots, **nflverse** for rosters,
production and play-by-play, **Sleeper** for popularity, **FantasyPros** (via
DynastyProcess) for expert consensus rank, and **DynastyProcess's**
`db_playerids.csv` for the crosswalk that reaches the last two.

That crosswalk is load-bearing. Sleeper carries a `gsis_id` for only 3,893 of
its 12,224 players and almost none who matter — Ja'Marr Chase and Jahmyr Gibbs
are both null — so joining on it directly resolved 61 of 567. Going through
DynastyProcess resolves 383 of 628 to FantasyPros consensus; the 245 that miss
are $1-2 bench players FantasyPros does not rank, which is the correct answer.

**Play-by-play is worth the download.** `play_by_play_2025.csv.gz` is 19MB
gzipped and is the only source for where on the field a touch happened
(red-zone and goal-line counts) and for what an offence likes to do (pace, pass
rate over expected, sack rate allowed). `readCsv` takes a column list because
that file has 372 of them across ~50k rows, and materialising all of it is 18M
property writes for the dozen fields anything reads.

**The pool is generated, not typed.** `scripts/build-player-pool.mjs` builds 628
players from nflverse: 2023-2025 weekly production, 2026 rosters, snap counts,
injuries, draft capital and the published schedule. Projections come from the
model documented in that file — recency-weighted points per game, shrunk toward
a positional baseline by sample size, age-adjusted, times expected games. Dollar
values are value over replacement converted to a share of the league's budget.
Kickers and defenses are regressed hard because their scoring barely predicts
itself year to year, which is why they price out at a dollar or two.

Everything a player card shows traces to an observation: bye weeks and matchup
difficulty from the 2026 schedule, floor and ceiling from one standard deviation
of the season total, consistency from weekly variance, injury risk from games
actually missed, and percentiles from the position's own distribution.

**The pool has to be deeper than the biggest league it serves.** A position
shorter than the league rosters does not error — `replacementLevels` falls back
to the worst player it has, which quietly understates that whole position. The
per-position caps in the builder are therefore derived from
`rosteredForTeams(LEAGUE_LIMITS.teams.max)` rather than typed: they used to be
hand-tuned numbers, and quarterback sat at 40 where a 32-team league rosters 53.
Deepening is safe by construction — candidates are sorted by projected points,
so anything a bigger cap admits is worse than everything already in, and cannot
move replacement level or a top-192 auction value. Growing the pool from 599 to
628 changed none of the original 599 players' values. `LeagueSettings` still
reports a shortfall if one ever reappears, and a test asserts none exists.

**Percentiles are how a number becomes meaningful.** Sixty per cent of snaps is a
committee back and a workhorse tight end, so every headline figure carries its
rank within its position. A field where the whole position shares one value —
targets for quarterbacks — gets no percentile rather than a confident 0.

**Never plot price against projected points.** The dollar value is a linear
function of VORP, which is a linear function of projected points, so that
scatter can only ever draw a straight line. It was shipped once and looked
authoritative while saying nothing. Where a relationship chart is wanted, one
axis has to come from an independent source — the market's consensus rank, or a
different measurement entirely (touches against EPA per touch).

Legacy services under `src/services/` named `real*` still generate numbers with
`Math.random()`. Nothing live reads them. Don't build on them.

## Conventions

- A `lint-staged` pre-commit hook runs `eslint --fix` and `prettier --write`, so
  commits touching an unformatted legacy file will reformat it. Expected.
- **The build scripts are linted, not just parsed.** `node --check` stood in for
  this once and proved only that `build-player-pool.mjs` was syntactically
  valid — it passed a builder that referenced a variable a refactor had deleted,
  and the failure surfaced minutes into a run, after the downloads. `no-undef`
  over `scripts/` catches that class in a second.
- **`npm run validate` passes and CI gates on it.** It used to be unpassable:
  lint reported 74 errors, all in the dead tree that `tsconfig.app.json`
  already excludes. `eslint.config.js` now reads that file's `include` list and
  lints exactly what tsc typechecks, rather than keeping a second copy of the
  list that would drift. Deleting the dead tree makes that block a no-op.
- **`type-check` used to check nothing.** The root `tsconfig.json` is a
  solution-style config (`"files": []` + project references), so `tsc --noEmit`
  against it silently exits 0 having compiled zero files. It now runs
  `tsc -p tsconfig.app.json`, whose `include` lists only the tree reachable from
  `main.tsx` — the dead tree still carries ~460 errors and one file
  (`correctAuctionData.ts`, since deleted) was truncated mid-literal, which
  aborted the whole check.
- **`strictNullChecks` is on for the live tree.** With it off, TypeScript cannot
  narrow a discriminated union on a boolean, so `BidCheck`'s `ok` flag — the
  engine's central design — never narrowed and `check.message` was an error the
  build never reported. Turning it on cost eleven fixes.
- Web fonts load from `index.html`, never via `@import` in a stylesheet that ships
  in a lazy route chunk — Vite's chunk loader waits on the stylesheet's load
  event, so an unreachable font host leaves the app on its loading screen forever.
  That bug was real; the comment in `bloomberg-terminal.css` explains it.
- `VITE_*` values are compiled into the bundle and readable by anyone. No secrets.
- The published artifact's `<head>` is not ours, so the single-file page carries
  its own `<meta name="viewport">`. Without it a phone assumes a 980px page and
  scales the whole app into a letterbox — which is exactly what happened once.

## State of the work

Done: the draft room (card and table boards with four swappable column sets, a
nomination clock, bid validation, undo, persistence), a 628-player pool built
from real production with projections, auction values, advanced usage from
play-by-play, per-offence context, full career arcs, three-season injury history
and FantasyPros consensus; seven-tab player dossiers with twelve bespoke charts;
a compare tray; the league board with money flow and tier depletion; a live
budget simulator; a bargain board; a separated advisor layer; defensive
personnel for all 32 teams; results with grades and export; Docker/nginx
deployment; a single-file build; a configurable league that re-prices the whole
board; a custom-rankings import that refuses to guess; app icons and a manifest
that describe what actually exists; CI gating `npm run validate`; a second window that follows the draft; keyboard operation, a
non-destructive reset, a draft that ends, and a draft file for the night the
laptop dies; 180 tests.

The CSV download used to do nothing inside the published artifact, whose
sandbox blocks any save a page starts itself. `src/lib/saveFile.ts` now goes
through the viewer's `downloads` capability where there is one and stays an
anchor everywhere else, so one call site serves both. `csv` is in that
capability's extended set and can be refused, in which case the same bytes go
out as `.txt`.

Open, roughly in order of value:

1. **Dead code**: 132 files and ~79k lines under `src/` unreachable from
   `main.tsx`, about 40k of it `src/data/playerDatabase/`. Deleting it was
   measured, not estimated: removing the 89 non-shadcn files leaves type-check,
   all 133 tests and the production build passing, with exactly one breakage —
   `src/components/ui/sidebar.tsx` imports `@/hooks/use-mobile`, and because
   `tsconfig.app.json` includes the whole `src/components/ui` directory, every
   shadcn file is an effective typecheck entry point even though nothing in the
   app imports it. So the safe deletion is those 89 files minus
   `src/hooks/use-mobile.tsx`, or those 89 plus `sidebar.tsx`. The 43 unused
   shadcn primitives are a separate call: they are a vendored library, and
   people add components from it later.
2. **A draft shared beyond one browser.** Two windows on one machine now stay
   in step (`draftSync.ts`), which covers the laptop-and-television case. Twelve
   people in twelve houses is a different problem and needs a server; the
   Artifact runtime offers no cross-viewer state, so there is no way to get it
   without changing what this repo is.

## Related

The published preview artifact lives at
https://claude.ai/code/artifact/7e72b3fa-0f58-46c9-8246-f3231e16849e — build it with
`npm run build:artifact` and republish by passing that URL to the Artifact tool so
the link stays stable. The published page declares the `downloads`
capability, which is what makes Export CSV work there; omitting `capabilities`
on a republish carries that declaration forward, so it only needs restating if
it is ever cleared. `scripts/build-artifact.mjs` embeds the 260 most valuable
players' faces and all 32 crests as data URIs (the CSP blocks external hosts),
strips the document shell, and adds the viewport meta the viewer's head lacks.

Two traps that file exists to remember. Vite puts the module script in `<head>`,
and the single-file build inlines the whole 2 MB bundle there — extracting only
`<body>` yields a page containing an empty `<div id="root">` and nothing else.
And the bundle registers a service worker, which is useless in a self-contained
page and logs a CSP error on every load, so the prelude shadows
`navigator.serviceWorker` before the bundle runs.

The app itself hotlinks the ESPN CDN and commits no images; `.cache/images/`
holds what the artifact build has already fetched.
