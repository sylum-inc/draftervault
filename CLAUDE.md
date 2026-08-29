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
OPENROUTER_API_KEY=sk-or-... npm run research:players   # web-research the pool
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
        ├── PlayerProfile.tsx     eight tabs: overview, production, usage,
        │                         offence, career, schedule, value, research
        │                         (unit replaces production+usage for defenses)
        ├── ResearchPanel.tsx     what the web said, with the link and the date
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
src/lib/researchContract.ts           what counts as a sourced finding (shared)
src/lib/rankingsCsv.ts                parsing and matching an imported ranking
src/lib/playerSearch.ts               finding a player by a name typed in a hurry
src/lib/saveFile.ts                   hands over a file, in browser or artifact
src/services/auctionDraftService.ts   the draft engine (rules, bidding, state)
src/services/draftAdvisor.ts          the opinion layer, deliberately separate
src/services/nflIdentity.ts           team colors, crests, headshots
src/services/draftSync.ts             tells other windows the draft moved
src/services/playerResearch.ts        the researched findings, lazily
src/data/nfl/research.json            per-player sourced findings (generated)
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
within budget minus the reserve (see below), and inside the
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

**Only some leagues auction the whole board.** This one auctions a
commissioner's sheet of the best players and snake-drafts the rest, so the same
money chases far fewer of them. `auctionSheetSize` on the league sets how many
are bought; the settings panel previews what the best player would then cost,
because for a format the model has never seen, what the room actually pays is
better evidence than the model.

Replacement level does **not** move when only part of the pool is auctioned.
This was got wrong once and it was instructive: setting the bar to the best
player left off the sheet — reasoning that they are your snake alternative —
left only a handful of players with any surplus, and the whole budget piled
onto them. It priced the best player at 77% of a team's entire budget, which no
auction has ever done. The error was assuming you get first pick of what is
left; eleven other teams are drafting too, and across both phases the league
still rosters the same players it always did. Only the money is concentrated. A
test now asserts no player exceeds 55% of a budget at any sheet size.

**The reserve only exists when the auction buys the whole roster.** A bid is
capped at the budget minus a dollar per unfilled starting slot, so nobody spends
themselves into a lineup they cannot finish. That is right when every roster
spot has to be bought and wrong the moment one does not. This league auctions a
sheet of 50-100 and snakes the rest, with no minimum a team has to buy — $200 on
three players is legal — so the reserve is zero whenever `auctionSheetSize` is
set. It was wrong in the expensive direction twice over: it capped our own bids
below the rules, and it made the room read as poorer than it is, so an opponent
looked tapped out at $88 while they could still go to $96. Every bid walked away
from on that basis is a player lost while holding money nobody required.
`reservedSlots` is the one place that decides it; three tests fail if the
condition is removed.

**Scoring is part of the league, and the pool is not built at yours.** nflverse
gives full-PPR points and the builder took them straight, so a point a catch was
hardcoded with no way to say otherwise. It is the biggest single lever in
fantasy scoring — a hundred-catch receiver is a hundred points apart between
full PPR and standard — so a half-PPR league drafting off this board was
systematically overpaying every pass-catcher.

`receptionPoints` now lives on `LeagueShape`, and the projection carries
projected catches beside projected points, so the client restates prices
exactly the way it already restates them for league shape — by subtraction,
which leaves every other component of the total untouched and so cannot drift.
Receptions run through the _identical_ recency-weighted, shrunk, age-adjusted
pipeline as points; a shrunk points figure minus an unshrunk reception figure
would be neither. At half PPR the replacement bar drops 28 points at tight end,
21 at receiver and 12 at back, and is unmoved at kicker and defence. It moves
0.3 at quarterback, because fourteen of them are projected for a fraction of a
catch — quarterbacks do catch trick-play passes and nflverse records it, so a
test asserting zero there would be asserting the data is wrong.

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

**The board renders a page at a time, and it is not a preference.** Measured
before it was changed: under a 4x CPU throttle, nominating froze the interface
for 4.3 seconds because React mounts a card per player and the board handed it
all 628. Memoising `PlayerCard` fixed re-renders but not mounting, which was
the real cost — `nominate` also had to stop depending on `teamId`, since it is
passed to every card and a new identity per team change defeats the memo. Sixty
cards mount, scrolling grows it, and the table takes the same limit applied
_after_ sorting with the bar scales still measured over the whole field.
Nominate went 4340ms to 663ms; the worst blocking task 3053ms to 375ms.

**A name typed in a hurry has no apostrophe.** The board's search was a
substring match on the printed name, so "jamarr" found nothing — Ja'Marr Chase,
a top-five player, invisible at exactly the wrong moment, along with Wan'Dale
Robinson and Amon-Ra St. Brown. `playerSearch.ts` strips punctuation from both
sides. It deliberately keeps generational suffixes where the importer's
`normaliseName` drops them: two sources spell "Kenneth Walker III" differently,
but somebody typing it should still find him.

**Teams have names, and one of them is yours.** Only one person runs this app
while eleven others bid, so "Team 7" is a number to hold in your head at the
moment there is no room for it. Names live in their own storage key rather than
in `LeagueShape`, because `sameLeague` decides whether a draft survives a
change and a rename must never throw one away. `getMyTeamId()` is what lets the
rest of the room be read as opponents.

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

**Research is a third register, and it never carries a number.** The pool knows
what a player has done and nothing about what happened last Tuesday — a holdout,
a torn ACL in a joint practice, a new coordinator. `scripts/research-players.mjs`
asks a web-searching model (OpenRouter, Exa pinned as the engine) about each of
the 628 and writes `research.json`. What comes back is findings plus a direction
— pay up, fade, or nothing material — and _no dollar figure_, because a
generated number sitting beside a computed one looks identical and carries none
of its provenance. There is no price field in the schema, so an opinion has
nowhere to masquerade as a measurement.

**The model's URL is never trusted.** A model asked for sourced findings will
produce something shaped exactly like one whether or not it found anything, and
a plausible URL is the cheapest part to fabricate. So the response's own
`url_citation` annotations are the allowlist: a claim citing anything else is
dropped and counted, and what is stored is the search engine's URL rather than
the model's rendering of it. Every finding also needs a publication date, so the
room can see that a "questionable" tag is from March. A player whose findings all
fail gets `NEUTRAL`, no headline, no confidence — strip the sources and the
position goes with them, because a confident FADE with nothing under it reads
identically to one with evidence. `researchContract.ts` holds those rules for
the same reason `valuation.ts` holds the league: the script that writes the file
and the panel that renders it must not be able to disagree.

Nothing is fetched from the browser. An auction moves faster than a search does,
and a key in the bundle is a key anyone can read out of it — so the output is a
static file, which is also what makes it work in the published artifact, where
the CSP blocks every external host.

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
non-destructive reset, a draft that ends, a draft file for the night the
laptop dies, named teams, a board that keeps up with an auction and configurable
reception scoring, and pricing for a partial auction; 216 tests.

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
