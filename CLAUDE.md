# Draft Vault — working notes

A fantasy football **auction draft room**. Vite + React + TypeScript, and it runs
as a pure front end: no backend, no database, no account and no API keys needed
to draft with it, which is how the published artifact runs permanently and how
draft night runs if anything goes wrong. There is now an _optional_ server
(`npm run server`) for saved drafts, draft history and server-side rebuilds. It
is strictly additive — see "The optional server" — and every path into it is
inert when it is not running.

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
npm run server       # the optional backend on 127.0.0.1:8788 (see docs/SERVER.md)
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
        ├── PickEditor.tsx        correcting one pick, from the cell showing it
        ├── BudgetPlanner.tsx     what a bid leaves behind, live
        ├── BargainBoard.tsx      our board against expert consensus
        ├── AdvisorPanel.tsx      the opinion layer, off by default
        ├── DraftFile.tsx         save the draft to a file, or load one
        ├── LeagueSettings.tsx    teams, budget, roster shape — re-prices the board
        ├── RankingsImport.tsx    bring your own values, previewed before applying
        ├── AuctionSheetImport.tsx  the sheet the commissioner circulated
        ├── ServerPanel.tsx       the optional server: saved drafts and rebuilds
        ├── SnakeOrder.tsx        the order the snake is called in
        ├── charts/               RangeBar, PercentileBars, SeasonMultiples,
        │                         ScheduleStrip, BidLadder, PositionSwarm,
        │                         OutcomeCurve, ConsensusRange, QuadrantScatter,
        │                         DraftFlow, TierDepletion, CareerArc
        ├── DraftResults.tsx      grades and export
        ├── Sparkline.tsx         one season, game by game
        └── Headshot.tsx          photo with monogram fallback

src/hooks/use-draft-preferences.ts    view, watchlist, queue, clock length
src/hooks/use-draft-server.ts         discovery + autosave, inert with no server

src/lib/valuation.ts                  league shape + points-to-dollars (shared)
src/lib/researchContract.ts           what counts as a sourced finding (shared)
src/lib/serverContract.ts             the wire between app and server (shared)
src/lib/rankingsCsv.ts                parsing and matching an imported ranking
src/lib/auctionSheet.ts               the commissioner's sheet, pasted or filed
src/lib/playerSearch.ts               finding a player by a name typed in a hurry
src/lib/saveFile.ts                   hands over a file or the clipboard, in
                                      browser or artifact
src/services/auctionDraftService.ts   the draft engine (rules, bidding, state)
src/services/draftAdvisor.ts          the opinion layer, deliberately separate
src/services/nflIdentity.ts           team colors, crests, headshots
src/services/draftSync.ts             tells other windows the draft moved
src/services/draftServer.ts           talking to the optional server, or not at all
src/services/playerResearch.ts        the researched findings, lazily
src/data/nfl/research.json            per-player sourced findings (generated)
src/data/nfl/pool.json                628 players: projections, values (generated)
src/data/nfl/player-history.json      per-player season and weekly scoring (lazy)
src/data/nfl/schedule.json            2026 season by team, with matchup difficulty
src/data/nfl/team-context.json        per-offence pace, PROE, red-zone rate
scripts/build-player-pool.mjs         builds the pool from nflverse
scripts/fetch-nfl-data.mjs            builds team identity from ESPN
scripts/build-icons.mjs               draws public/icons/ with no image library
server/index.mjs                      the optional server: config, HTTP, static
server/api.mjs                        the routes, as a function of a request
server/store.mjs                      saved drafts and their versions, on disk
server/jobs.mjs                       the batch scripts, spawned and polled
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

**The sheet is a list, not a number.** A size is a guess at the sheet — the best
N by surplus, as though the commissioner had picked ours off our own board. He
picks off consensus rankings, so the real list holds players we price at $2 and
leaves out players we price at $30, and both of those are guidance the room
needs at the moment a name is called. `src/lib/auctionSheet.ts` turns a paste
into rows and `pricePool` is handed the mask it produces; `Player.onSheet` is
that mask read back, so the board can say "snake" rather than "$1". Parsing is
its own file because `parseRankings` reads one cell a line through a column map:
"Chase, Gibbs, Robinson" out of Slack becomes one row and loses two players,
which is the worst failure a sheet can have. Matching is not its own — it is
`resolveRankings`, which already refuses to guess, plus one narrowing that a
stated club buys: two Robinsons are both backs, so the position cannot separate
them and "B. Robinson RB ATL" can. A sheet player nobody bids a dollar on is
marked unsold rather than struck off, because shortening the list would move
`auctionSheetSize` — re-pricing the room mid-auction and, since `sameLeague` is
what lets a saved draft replay, refusing to restore the draft being played. The
engine ships `removeFromSheet`/`getSheetRemaining` for it, and the snake phase
is what calls them: the "Nobody bid" control on the stage marks a player passed
over, and `getSheetRemaining()` emptying is the condition the auction ends on.

A list can be too concentrated to price. The whole budget chases whatever is on
the sheet, so twelve names put the best player at 119% of a budget — a headline
`validateBid` must reject for every team in the league. The import prices a list
before accepting it and refuses one whose top clears a whole budget.

The bound is the budget, deliberately not the 55% the pool's own tests assert,
because those answer different questions. 55% is a sanity check on the _model_,
over the whole board it was fitted to. A commissioner's list is not the whole
board: thirty good players beside thirty dollar players is a real sheet, and the
money genuinely does concentrate on the thirty. Expensive is not broken;
unbiddable is. And it is not a count in either direction — one star among
thirty-five bench players concentrates the money exactly as twelve names would —
which is why the check prices the actual list rather than measuring its length.
Reaching it is not a setting anybody types: it happens through the paste box,
when a surname-first export or a defence block written in nicknames resolves a
fraction of its names and sixty quietly becomes eighteen.

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

**The phase is derived; the pick log records which one each pick happened in.**
`getPhase()` returns `auction` until every player on the sheet is either sold or
marked unsold — `getSheetRemaining()` empty — and `snake` after. Nothing stores
"we are in the snake now", so reloading, following a second window, replaying a
file and undoing all land on the same answer, because they all replay the same
log. With no sheet in force there is no snake phase at all: a _size_ says how
many players are bought and not which, so the room cannot know when the money is
finished, and guessing would take the bid box away with names still to call.
Getting back across the boundary is worth stating precisely, because the
obvious answer is wrong. Undoing a snake pick does _not_ do it: the phase reads
the sheet, and taking back a pick of somebody who was never on the sheet leaves
it just as empty. The ways back are undoing far enough to unsell the auction
pick that emptied the sheet, or `returnToSheet` on a player the room passed
over. What is free is the mechanism — nothing had to be told the phase moved,
because nothing stores it.

The pick log entry gained a `phase`, and that is not storing something derived:
it is a fact about the transaction, exactly like the price. It has to be stored
because it cannot be recovered afterwards — marking one more player unsold moves
where the auction ended, and every pick already made would silently reclassify.
What stays derived is _whose turn it is_. `getSnakeOnTheClock()` walks the
serpentine schedule from an empty snake each time rather than indexing into it:
indexing looks obvious and is wrong, because skipping a full team shifts every
later slot, so the team after a full one gets handed two picks in a row. Two
hundred iterations of arithmetic is not worth being clever about.

**Money counts the auction; supply counts both.** A receiver taken in the snake
is genuinely off the board, so scarcity, tier depletion and every "gone" count
include him — waiting for him is no longer an option, which is what those
numbers are for. But nobody paid for him, so he appears in nothing that measures
money: premium, inflation, budget, surplus and the grade's spend column all read
the auction half only. `draftCost` stays **undefined** on a snake pick and never
becomes 0, because 0 is a claim — "bought for nothing" — and the two are
indistinguishable once one has leaked into a sum. TypeScript cannot help here:
the field was already optional, so every `draftCost ?? 0` had to be found by
hand and decided one at a time. `MarketState.scarcity` now has `gone` and `sold`
genuinely differing, and they are meant to.

Inflation is short-circuited to 1 for the whole snake phase. Money left is fixed
while value left goes on shrinking, so without it the ratio climbs on its own
until it pins at the 1.8 clamp and `MarketPanel` reads "money is chasing scraps
— expect overpays" for a hundred and forty picks in which nobody spends a penny.
`DraftFlow` is fed auction picks only for the same reason: a hundred and forty
zero-dollar points draw a flat line, and a flat line on a money chart is
indistinguishable from a room that has run out — a real and different thing that
chart exists to show.

**The snake order is fixed in advance and lives in its own storage key.** The
commissioner sets it; it is not derived from auction spending and not drawn on
the night. `draft-vault:snake-order:v1` rather than a field on `LeagueShape`,
for exactly the reason team names are: `sameLeague` decides whether a draft
survives a change, and a reorder must never throw one away. It is repaired
against the current teams on every read, so an order that has lost a team cannot
drop that team out of the draft. Reordering mid-draft is allowed on purpose —
the order gets announced at the table and it gets announced differently often
enough that the alternative is running the night off a list everyone can see is
wrong. It has its own panel because `LeagueSettings`' Apply clears the draft.

`validateSnakePick` returns the same typed `BidCheck` a bid gets, composed from
`checkRoster` — the half of `validateBid` that has nothing to do with money,
split out for exactly this — plus the two things only a free pick can get wrong:
being taken while the auction runs (`not-in-snake`) and being taken out of turn
(`not-your-turn`). `draftSnakePick` re-checks it, as `draftPlayer` re-checks
`validateBid`. A $0 auction bid is still rejected as `invalid-amount`; the free
pick is its own call, not a bid of nothing.

`NominationStage` takes `mode: 'auction' | 'snake'` as its structural branch,
and that is deliberately the _only_ phase-shaped prop it has. In the snake there
is no bid box, no stepper, no value verdict and no winning-team select — the
order chose the team — only who is on the clock, the round and pick, and a
draft button. The file and the second window carry the phase on every pick and
the order beside the sheet; storage stays at version 2 and the file at version 1,
because bumping the storage version would make `restore()` refuse the draft
already sitting in the owner's browser. A pick with no `phase` is an auction
buy, which is what it was.

**A ceiling shown beside the bid box has to be the ceiling the engine will
accept.** `getBidCompetition` answers who can still beat the number on the
table, and every dollar of it comes from `spendableFor` — the same call
`validateBid` makes — rather than from a second copy of the arithmetic. A test
bids each reported ceiling and then a dollar more, and asserts the engine takes
the first and rejects the second, because a number the room reads off the screen
and the engine then refuses is worse than no number at all. Teams with no room
for the player are counted rather than listed at $0: they are not quiet bidders,
they cannot bid at any price, and the same goes for teams whose money cannot
reach the bid. In this format the ceiling is essentially a whole remaining
budget, which is higher than the room expects — and that is the point, because
believing the opposite is what lost players to opponents who were never
actually tapped out.

What a rival would _actually_ go to is a different claim and it is not in the
engine. `readTheRoom` is the advisor's, it prices the player against that team's
own holes through the analytics the engine already computes rather than a second
pricing model, and it is capped at the legal ceiling — an estimate above the
rules is advice to fear something that cannot happen. The two numbers are
rendered in different panels on purpose: the rules on the nomination stage, the
guess in the dashed box, never interleaved in one column.

**Inflation is one definition and it carries its workings.** The multiplier was
already computed, and printed with nothing behind it; a number nobody can
interrogate is the first thing to be talked out of when the bidding gets loud.
`getInflationBasis` returns the ratio _and_ its terms — money left, value left,
how many players that value is spread over, which end of the clamp it hit, and
whether it is frozen for the snake — and `calculateMarketInflation` is now that
object's first field, so the panel cannot explain a different number from the one
the board is pricing at. `inflatedPrice` in `valuation.ts` is the single
restatement of a list price; `getBargains` used to write it out by hand and now
goes through it too.

The adjusted price is handed out as a closure (`getPriceAdjuster`) rather than
written onto the Player object, and that is not style. It changes on every pick,
and the card board's sixty memoised cards currently do not re-render on a pick
at all because their props are stable element references — a price prop would
re-render all sixty every time, each re-resolving identity and team colours, and
no test would notice. So it goes only where a price is being decided: the stage,
the table's value column, the market panel. A player who is not on the sheet
keeps his list price untouched, because inflating a $1 snake player to $2 states
that the money is chasing him, which is the one thing the sheet says it is not.

**The advisor speaks for the owner, and says so.** It used to be handed
`activeTeam` — whoever is selected in the winning-team dropdown. That is a
_recording_ control: it says who just bought a player, and through a normal
auction it sits on an opponent most of the night, so the advice was about
somebody else's roster holes and somebody else's money, printed in a panel that
reads as yours. It now takes `getMyTeamId`'s team, prices its own analytics
against that roster, and names whose side it is on in the header. With no team
marked it says that instead of guessing. The snake half is the one exception and
deliberately so: a free pick belongs to whoever the order says is on the clock,
and the header names them.

**Nomination is a plan, not a name.** `adviseOnNomination` was extended rather
than replaced — the early-drain spine and its wording were right — and now
returns up to three calls with a kind each, plus the players to keep _off_ the
block. Protecting needs a statement of what you want, so the watchlist is passed
in from the room; it is a per-person preference and the engine holds nothing of
the kind. The part worth stating is the flip: draining only works while there is
money to drain, so the room's unspent share decides the order the calls come in,
and a player nobody left can outbid stops being protected and becomes the first
name to call. At the very first nomination every position has an unfilled
starting slot, so "a player you do not need" matches nobody — the drain falls
back to the dearest player you are not protecting and says why it is still the
right call rather than claiming a need that does not exist.

**Alerts are keyed on what they are about.** They were keyed on message text,
which collides the moment two read alike, and React drops one without saying so.
Every alert now carries an id naming its subject — `tier-break:WR:1`,
`position-run:RB`. Two new ones: a run, which counts _both_ halves because a
receiver taken in the snake is exactly as unavailable as one bought for $40, and
a tier break, which fires on the last player of the tier currently being drafted
out of and quotes the step down off it. The step is in points always and in
dollars only when both sides of it are being auctioned, because an off-sheet
player sits at the $1 floor and subtracting that would invent a cliff the size
of the whole tier. What is _left_ at a position is counted by replacement level
rather than by the sheet, since in the snake nobody left is on the sheet at all
and a for-sale count would report every position as empty and every pick as a
run.

**Nobody has confirmed the league until somebody says so.** With nothing in
storage the board prices at the league the _pool_ was built for — full PPR, no
flex — because that is what nflverse scores and what the builder had to choose.
It is a valid league and almost certainly not the one being played, and every
number on every card derives from it. Making scoring configurable did not fix
that; it only made the fix reachable, and a fresh browser on draft night still
opened priced under somebody else's rules. Measured on the shipped pool, half
PPR puts Ja'Marr Chase at $48 where full PPR says $53 and moves Puka Nacua $50
to $46, while the backs hold — about 9% of a top receiver, on the position group
an auction is mostly about.

So the first run is gated: the settings panel opens over everything, cannot be
escaped or dismissed, and states what the defaults are and why they are probably
wrong. Confirming is the only way out.

The confirmation has **its own storage key**, and that is not redundancy.
`writeStoredLeague` removes the league key when the shape matches the pool's,
since there is nothing to remember — so "a league is stored" means "the league
differs from the default", which is a different question from "somebody has
looked at it". A league that happens to match the defaults still has to have
been chosen. `confirmLeague` also exists because `setLeagueShape` returns early
on a no-op, rightly, since it clears the draft: without it, confirming the
defaults exactly as they stand wrote nothing and the gate asked again on every
load.

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

The commissioner's sheet survives it too, and that is the exception worth
stating because it looks like a league change: `setAuctionSheet` pins
`auctionSheetSize` to the length of the list, so `sameLeague` afterwards reports
a different league. The condition that makes it safe is that a sheet touches no
roster rule and only ever loosens the reserve — which this format already holds
at zero — so every pick already made is exactly as legal as it was and only
prices move. What it does cost is the two gates that compare that stamp: the
saved draft, and the stash a reset left behind. Both are re-stamped inside
`setAuctionSheet` rather than quietly disabled — the undo-the-reset net exists
because Reset once destroyed an afternoon's work, and importing a list is not a
reason to cut it. Removing the sheet leaves the size where the sheet put it (the
room still auctions that many, we simply no longer know which), because saying
"all of them" would bring the reserve back and make bids already accepted
retrospectively illegal.

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
focus lands on the winning-team select, and Enter in the bid sells. `u` undoes,
`r` puts back what `u` took, `s` saves the draft to a file and `c` copies the
whole thing to the clipboard. Shortcuts never fire inside an input, select or
textarea, and a modal owns the keyboard while open — the guard is what keeps
typing "u" in the search box from undoing a pick, and it is why four more
single letters cost nothing.

**A file is the escape hatch.** `exportDraft()`/`importDraft()` carry the pick
log _and_ the league, because prices are meaningless without the league they
were bid under. Loading replaces the board, so it asks first when a draft is in
progress, and picks that no longer validate are counted rather than dropped
quietly.

**A pick can be corrected in the middle, not only at the end.** Undo pops the
log, so noticing at pick sixty that pick forty was wrong meant undoing twenty
good picks and re-entering them from memory — which is how one misheard price
becomes a lost afternoon. `correctPick(index, change)` amends the one entry and
then replays the amended log through the same private `replay()` that
`restore()`, `restoreClearedDraft()` and `importDraft()` come through, so a
corrected draft is built by the code that built the original rather than being
the old draft with one entry painted over. It reports `{ restored, skipped }`
exactly as an import does, because a correction can legitimately leave a later
pick with no legal way to have happened: a raised price that busts a budget, a
player who is now taken twice.

That count has to exist _before_ anything is applied, which is what
`previewCorrection` is. It replays the amended log against shadow teams — clones
that start empty and fill as the log is read — through `checkBid` and
`checkRoster`, the same two calls the live path makes. `checkBid` was split out
of `validateBid` for this exactly as `checkRoster` was split out of it for the
snake: a second copy of "can this team afford him" is a second answer, and a
warning that disagrees with what then happens is worse than no warning, so a
test drives one against the other. A correction that cannot keep the pick it is
correcting is refused rather than applied and counted — applying it would
silently delete the pick somebody was trying to fix. The refusal is reported as
a refusal, too, and not as collateral: listing the edited pick's own failure
alongside genuinely later ones headed it "1 later pick could no longer have
happened" — naming the pick being edited — under an enabled button the engine
then always refused, on the one screen whose whole job is stating what an action
will cost.

A correction that drops later picks stashes the pre-correction log where a reset
stashes it, so it can be taken back. It is the sharper of the two destructive
acts rather than the lesser: a reset is all-or-nothing and obvious, while this
deletes an arbitrary tail behind a button reading "Apply, losing 34". Reset
earned its net by destroying an afternoon, and there is no argument for the
finer instrument going without one.

The editor offers players who are already drafted, marked with where they went.
The correction the whole panel exists for is "that was the wrong man, and the
right one is who I recorded three picks later", and excluding taken players made
exactly that unreachable in both directions while telling the owner "nobody on
the board by that name" about somebody sitting in the grid behind the dialog.
Choosing one is not silently allowed: the preview replays and reports him as
taken twice, which is the honest cost.

**A correction carries the phase; it never re-derives it.** Correcting a pick
can move where the auction ended, and that is right: swap the sale that emptied
the sheet for a player who was never on it and there is a sheet player still to
sell, so `getPhase()` reads `auction` again. The snake picks after it keep the
half they were taken in and replay through `applySnakePick`, which re-checks
what cannot have been true — the player exists, is not taken, fits the roster —
and not whose turn it was. That is the principle a reorder is already held to: a
logged pick is a record of what happened, not a proposal to be re-adjudicated
against a sheet that has since changed shape. So `phase` is not among the fields
a correction may carry. Relabelling a sale as a free pick would unspend money the
room spent, relabelling a free pick as a sale would invent a price nobody paid,
and when the wrong half really is recorded the repair is to undo back to it,
because that is the only thing that also puts the sheet back where it was. A
cost on a snake pick is refused for the same reason `draftCost` stays undefined
rather than becoming 0, and a $0 correction is refused exactly as a $0 bid is.

The editor is a cell of the 12x16 grid, because the grid is where a mistake is
noticed. `getDraftBoard` therefore carries the pick's `index` in the log, read
off the log rather than inferred from `pickNumber` — the two agree today, and a
cell that edits the wrong entry because they stopped agreeing is the worst thing
this could do. `.dr-overlay` had no CSS at all, so the board it opens in was
rendering in the page flow below the whole room rather than over it; an editor
you have to scroll to find is an editor nobody uses mid-draft, so the rule now
exists and `CompareTray` becomes a real overlay with it.

**Undo can be undone.** It sits under one key next to the one that focuses the
search, and two accidental presses lost two picks with nothing on screen to say
which. Undone picks go on a stack that any new pick clears — the same rule the
cleared-draft stash lives by, because once the draft has moved on the branch
that was taken back is genuinely history. `redoLastUndo()` puts a pick back
through the ordinary draft path rather than pushing it onto the log, since the
engine re-checks everything it records and a redo is no exception; a pick that
can no longer be made is dropped rather than kept, because an offer that fails
every time it is taken up is worse than no offer. The stack is deliberately not
persisted and deliberately not shared: the pick log is the only shared fact, and
a window that never pressed undo must not offer to redo. A correction, a reset,
a league change and a file all clear it.

**The record says how exposed it is, in picks.** On the night there is no
server: the draft is a pick log in one browser profile, and a cleared cache or a
crashed tab takes the afternoon with it. The only defence is a copy somewhere
else and the thing that reliably fails is remembering to make one while an
auction is running, so the app counts instead of reminding. `picksSinceExport()`
is zero on an empty board, the whole draft when no copy has ever been made, and
otherwise the distance from the last one; the top bar bands it — silent-grey
under eight, amber to twenty, red past it, because a chip that shouts from the
first pick means nothing by the fortieth.

The mark describes the text that left rather than the board it left from. A save
is not instantaneous — the artifact's downloads capability puts a confirmation in
front of a person, and the clipboard can wait on a permission prompt — so
stamping the log as it stands after the await marked any pick made during the
save as one that had gone out. `snapshotMark()` is taken beside `exportDraft()`
and handed back to `markExported`.

The mark is also forgotten wherever the log it describes is thrown away — a reset,
a league change — and `picksSinceExport` treats a mark longer than the current log
as no mark at all. Left in place it subtracted its way to exactly 1, the calm end
of the scale, for a fresh draft that had never left the browser. A reload is not
that case and deliberately keeps it: replaying the stored log lands on the very
draft the mark describes.

`saveTextFile` distinguishes `saved` from `handed-off`. Only the viewer's
downloads capability can confirm a file exists; an anchor click reports nothing,
and a cancelled Save-As dialog looks identical to a success. A handoff still
counts as the draft having left, because it is the best evidence an ordinary
browser can give, but the room says "handed to your browser — check it
downloaded" rather than claiming a file it cannot see.

It is a fingerprint and not a count, because a count cannot answer the question:
undo a pick and re-enter it at the right price and the log is the same length
and a different draft, and a correction leaves the length alone entirely. The
mark stores an FNV-1a of the log's own JSON beside the length, so "different" is
answered exactly and "how far" is answered as a floor — at least one change, and
never fewer than there were. It lives in `localStorage` because a page refresh
is not a backup and must not read as one.

Two things clear it and one deliberately does not. A file save clears it and a
clipboard copy clears it, both wired to the outcome rather than the click — a
save the viewer declined is not a save. `importDraft` clears it too when every
pick replayed, since a draft that came out of a file demonstrably exists in one.
The optional server's autosave does **not**, and that is the decision worth
stating: the server is an overlay that is usually not running, this counter
measures what the owner is holding, and a number that goes quiet because of a
backup nobody remembers making is a number that lies in the one direction that
costs an afternoon.

`c` copies the same `exportDraft()` payload a file carries, so what lands in a
message or a note loads straight back through `importDraft`. The clipboard is
not permitted everywhere — an insecure origin, a browser that asks, the
artifact's sandbox — so `copyTextToClipboard` reports rather than throws and the
room falls through to the file, which is the same bytes through the other door.
Both live in `DraftRoom` rather than in `DraftFile`, because both are also on
the keyboard and a second copy of "the record has left" would be a second answer
to whether the night is backed up.

**A second window follows; it does not receive.** `draftSync.ts` posts one
thing on a `BroadcastChannel` — that the draft moved — and the receiving window
rebuilds from the same localStorage the sender just wrote. No draft state
crosses the channel, so two screens cannot come to believe different things; a
message that carried the change could arrive out of order and they would. This
is what the pick-log-is-the-only-shared-fact rule was being kept for. It is
same-browser only. There is a server now, and it deliberately does not change
this: it stores copies of the draft, it does not carry one. Nothing about whose
turn it is or what a player cost travels through it, because the moment two
screens could learn the draft from two different places they can disagree about
it, and the pick log being the only shared fact is what stops that. A draft
across twelve houses is still a different problem.

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

**There are two doors into the research file, and the same lock on both.**
`scripts/research-players.mjs` asks OpenRouter, which needs a key and spends
money. `scripts/ingest-research.mjs` folds in what a Claude Code workflow found
with its own web search, which needs neither. Both come through
`validateResearch`, so a finding either door admits is a finding the other would
have admitted too.

The allowlist is the one thing that differs and it is weaker on the agent side,
so it is written down rather than glossed: OpenRouter attaches the search
engine's own `url_citation` annotations, which a model cannot forge, while an
agent reports the URLs its own searches returned. Two things close some of that
gap. An audit pass re-fetches a sample of the strongest claims and checks the
page says what was claimed — on the first full run that was 24 of 232 findings,
of which 14 held entirely, 9 held in part and 1 could not be read at all. And
its answer feeds back: `--reject` takes the URLs that did not stand up and drops
every finding citing them, because a citation that has been checked and failed
is worse than one nobody looked at — it has been through the process and comes
out wearing the process's authority.

When a refusal lands, the headline goes too. Josh Jacobs kept a summary reading
"after missing most of camp with a groin injury" after the page making that
claim was found to say the opposite. The findings that survived are still shown;
the one line that summarised all of them, including the wrong part, is not — it
is the line most likely to be read and least likely to be checked.

**A wrong id does not fail loudly, so the name is checked too.** Every id in the
pool belongs to somebody, so a transposed one silently writes one player's
findings onto another. On the first agent run four ids in ten were wrong and
Puka Nacua's psoas injury landed on Tucker Kraft, who was perfectly fit. The
ingester refuses any record whose id belongs to a different player than the name
beside it — the same refusal to guess that `rankingsCsv` and `auctionSheet`
already live by, turned on our own pipeline rather than somebody else's paste.

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

Nothing is fetched from the browser, and the bundled static file is still the
first tier. An auction moves faster than a search does, and a key in the bundle
is a key anyone can read out of it — so the output is a file the app loads like
any other, which is also what makes it work in the published artifact, where the
CSP blocks every external host. That has not changed and is not allowed to: the
research the room reads on the night is `research.json`, sitting in the bundle.

What the optional server adds is a place to _start the script from_ that is not
a terminal — see "The optional server" below. The key lives in that process's
environment and nowhere else. No route returns it, no route returns a prefix or
a length of it, and the only thing anything ever learns about it is the boolean
`jobs.research` in the handshake. It goes from the server process straight into
a child process it spawned, which is the same script with the same flags a
person would have typed. The browser still holds no key and still fetches
nothing from OpenRouter, so the artifact and the single-file build are exactly
as they were.

**Identity is two-tiered.** The bundled snapshot in `src/data/nfl/` paints first
with real names, colors and faces and needs no network; `refreshIdentity()` then
merges live injury/team updates from ESPN over it and silently falls back to the
snapshot on any failure.

## The optional server

**Everything below is an overlay. The app is what it was without it.** `npm run
server` starts a Node process that holds saved drafts with a version history,
can start the two batch scripts over HTTP, and can serve `dist/` so the whole
lot sits behind one tunnel. Stop it and nothing is lost and nothing degrades:
the pool is a bundled file, the draft is in localStorage, the second window
follows over a BroadcastChannel, and the draft file is still the escape hatch.
That is not a fallback path, it is the ordinary one — it is how the published
artifact runs permanently, and it is what draft night falls back to at the first
sign of trouble.

**Discovery is opt-in, and that is the load-bearing decision.** The obvious
design is to ask the current origin whether it happens to be a server. That
costs a failed request on every load of an app whose normal condition is having
no server, and a browser prints that failure to the console whether or not it
was speculative. A red line under a board somebody is drafting off is a reason
to distrust the board. So the address has to come from somewhere deliberate, and
there are exactly three: what the owner typed into the server panel
(localStorage), a `<meta name="draft-vault-server">` the server injects into the
page _it_ served — which is how the tunnelled case needs no typing at all — and
`VITE_DRAFT_SERVER` at build time for a dev server on another port. None of
those exist in `build:single` or `build:artifact`, so both are inert by
construction rather than by handling an error. The bar the tests hold it to is
therefore not "the failure is caught" but "no request was made": with nothing
configured, `useDraftServer` subscribes to nothing, sets no timer, calls no
`fetch` and writes nothing to the console.

**`src/lib/serverContract.ts` is the third file of its kind, and it is why the
server can be trusted with a draft.** `valuation.ts` stops the pool builder and
the board disagreeing about a price; `researchContract.ts` stops the research
script and the panel disagreeing about a source; this stops `server/` and
`draftServer.ts` disagreeing about what a saved draft is. The server imports it
through Node's type stripping exactly as the pool builder imports `valuation.ts`
— the same functions, not a copy — so `validateSaveDraft` refusing a payload in
the browser and refusing it on arrival is one function refusing it twice.
`jobArgs` is in there for the same reason and one sharper one: it is the entire
surface between an HTTP request and an argv, and it can only emit strings it
composed itself.

Every response carries a contract number and **a client and a server that
disagree do not talk.** The panel says which half is stale and refuses
everything but the handshake. Guessing is the tempting alternative and it is
wrong: the two halves ship from one git checkout and are updated together, so a
mismatch always means somebody forgot to restart the server after a pull — ten
seconds to fix — while the cost of guessing is a draft written to disk in a
shape the other half misreads, which loses the afternoon the server exists to
protect. The health response is the handshake, so its field set is frozen: a
client of any version has to be able to read `kind` and `contract` out of it in
order to find out that it cannot read anything else.

**The server is a filing cabinet, not a second engine.** A saved draft is the
exact text `exportDraft()` produced, stored as an opaque string with a name and
a timestamp beside it. The server never parses it, never counts the picks, never
learns the league and never decides whether a bid was legal — a test asserts
that a payload of pure nonsense round-trips byte for byte. It cannot do
otherwise: the rules are in `auctionDraftService` and the prices in
`valuation.ts`, and a server that understood either would be a second place they
live. Loading goes back in through `importDraft`, the identical door a file from
a USB stick comes through, so a restored draft is validated by the same code and
picks that no longer replay are counted rather than dropped. This is also why
`VersionSummary` carries `bytes` and not a pick count: a pick count would
require reading the payload, and the honest number is how many replayed anyway.

**Storage is JSON files in a directory, and that is not a placeholder for a
database.** One person keeps a few dozen drafts of about fifty kilobytes each.
What the store has to be good at is being there at eleven at night when the
laptop running the auction has stopped being there, and a directory of plain
files is the best possible shape for that: `cat` reads it, `cp` copies it, a USB
stick carries it, a text editor opens it, and a half-finished write is repaired
by deleting one file. SQLite would add a dependency and turn recovery into "find
a sqlite3 binary". Versions are separate immutable files — a save is a new file
plus one appended line in the index, never a rewrite — so losing a version takes
a deliberate deletion. A full hybrid draft is about 380 picks, so about 380
versions of 50 kB: nineteen megabytes to make no state of the draft unreachable,
which is the right amount of disk to spend on draft night. The version file is
written before the index that names it, so an interruption leaves an orphan file
rather than an index entry pointing at nothing.

**Progress is polled, not streamed, and that was decided rather than skipped.**
Server-Sent Events are within the standard library's reach and would have been
about the same amount of code. Three things went the other way. An `EventSource`
cannot carry an `Authorization` header, so the token would have had to travel in
a query string and land in every proxy log between the laptop and the tunnel —
a real downgrade for the one secret this design has. A tunnel is also the worst
place for a long-held connection: it buffers, it idles out, and
reconnect-and-resume is more code than polling ever was. And these jobs run for
twenty minutes printing a line every second or two, so a stream buys nothing a
poll every second and a half does not — while the poll survives a closed laptop
lid, a page reload and the tunnel dropping entirely, because the job's state
lives in the server process and not in a socket.

**A rebuild never writes over the live data.** `build-player-pool.mjs` gained an
`--out` flag and the server points it at a staging directory, because a fresh
pool changes every price on the board and a draft in progress was bid at the old
ones — the same objection `restore()` makes to a save stamped with a different
league. Moving the result in is a deliberate act taken between drafts, followed
by a rebuild of the app. The research job is staged too and is _seeded_ from the
current `research.json` first, because that script merges into whatever is at
`--out` and skips anyone asked about recently; pointed at an empty directory it
would lose both and pay for all 628 players again.

**Auth is honest about being one person behind a tunnel.** A shared token in
`DRAFT_VAULT_TOKEN`, required on every route but the handshake, compared with
`timingSafeEqual`. Not accounts, not passwords, not sessions — there is one
person, and a login screen for him would be theatre with a real maintenance
cost. What that buys and what it does not is worth stating plainly: **anyone who
learns the tunnel URL and the token can read, overwrite and delete every saved
draft, and can start a pool rebuild or spend the OpenRouter key on a research
run.** They cannot read the key, cannot run anything but those two scripts, and
cannot pass an argument to either — `jobArgs` composes the whole argv. Without
the token they get the handshake and nothing else. The token is a bearer header
the caller attaches on purpose rather than a cookie a browser attaches for them,
which is the entire CSRF class gone by design rather than mitigated, and
`Access-Control-Allow-Credentials` is therefore never sent.

**Binding is loopback by default, and there is no way to get an unauthenticated
server onto a public interface.** `cloudflared tunnel --url
http://127.0.0.1:8788` and `ngrok http 8788` both run on the laptop and connect
outward, so loopback is reachable through the tunnel and unreachable from the
room's wifi; binding `0.0.0.0` buys nothing the tunnel does not already give.
Starting on a non-loopback host without a token is refused at startup with an
explanation, because the moment that combination is possible somebody reaches it
by accident at eleven at night.

**CORS is answered by removing the cross-origin case.** A tunnel means the
browser's origin is not localhost, so "allow localhost" is the wrong answer
here. When `dist/` exists the server serves it, the page and the API share an
origin, and CORS never arises — which is also what makes the injected meta tag
enough to configure the client. The allowlist exists for the one case left, `npm
run dev` on :8080 talking to :8788, and it is an explicit `DRAFT_VAULT_ORIGINS`
plus loopback origins when the server is itself on loopback. An origin is echoed
only if it is on that list; nothing is reflected blindly, and `Vary: Origin` is
sent either way so a cache cannot hand one origin's allowance to another.

**The autosave joins the change listeners; it does not take them.** It
subscribes through `addChangeListener`, which returns an unsubscribe and is a
`Set`. `DraftRoom`'s window sync was using `setChangeListener`, which clears that
Set — whichever mounted second would have silently taken the other's slot,
leaving either a television that stopped following or a backup that stopped
being written, with nothing on screen to say so. Both are on the Set now. Saves
are debounced two seconds so a run of three quick nominations is one version
rather than three, they never overlap (a change arriving mid-flight is
remembered and written after, so the history reads forwards), and after three
consecutive failures the backup stops and says so — a dropped tunnel does not
come back because a fourth pick was made, and a request per pick for the rest of
the night is a request per pick that can time out at the worst moment.

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
  `VITE_DRAFT_SERVER` is an address, not a credential, and is the only one the
  server work adds. The shared token is typed into the panel and kept in the
  owner's own localStorage; the OpenRouter key never leaves the server process.
- **`server/` is linted, not typechecked.** `tsc` reads `tsconfig.app.json`,
  which is the tree reachable from `main.tsx`, so nothing typechecks the `.mjs`
  server at all. `eslint.config.js` therefore lints `server/**/*.mjs` beside
  `scripts/**/*.mjs` under `no-undef`, which is the only thing standing between
  a renamed export in `serverContract.ts` and a server that starts fine and then
  throws on the first request. What does check the contract is
  `src/test/services/serverRoutes.test.ts`: it imports `server/api.mjs` and
  `server/store.mjs` straight into vitest and drives the routes with nothing
  listening on any port, which is the only shape of that test compatible with
  `npm run validate` running on a laptop with no server.
- The server writes to `.draft-vault-data/`, which is gitignored. It is somebody's
  draft history, not project content.
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
reception scoring, pricing for a partial auction, the commissioner's actual
sheet imported by paste or file, and the snake half of the hybrid draft — a
derived phase, a fixed serpentine order, free picks that carry no price
anywhere, and advice written for a draft where money decides nothing; the four
things the owner asked for by name — who can legally outbid you and who
plausibly would, inflation-adjusted prices that carry their workings, a
nomination plan with the players to protect, and run and tier-break alerts with
stable ids; and an optional server the owner asked for — saved drafts with a
full version history, an autosave that backs the night up as it is played, the
pool and research rebuilds startable over HTTP with their progress polled back,
somewhere for the OpenRouter key that is not the bundle, and a token behind a
tunnel; and the record made correctable and safe — any pick amended from the
cell that shows it with what the amendment costs named first, an undo that can
be undone, a visible count of how many picks stand between the board and the
last copy of it that left this browser, and that copy one keystroke away as a
file or on the clipboard; 477 tests.

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
2. **A draft shared beyond one browser.** Two windows on one machine stay in
   step (`draftSync.ts`), which covers the laptop-and-television case. The
   optional server does _not_ extend that and was not built to: it stores copies
   of the draft, it does not carry one, and nothing about whose turn it is
   travels through it. Making it authoritative would mean a second place the
   draft lives and a second place the rules would have to be enforced — the two
   things the pick-log-is-the-only-shared-fact rule exists to prevent — so it is
   a real design change rather than a route to add. The published artifact
   cannot have it either way: its CSP blocks every external host.

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
