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
npm run fetch:adp    # refresh the draft market alone, in seconds, before draft day
npm run backtest     # score the projection model against 2023-25, and the baselines
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
        ├── SpendOutlook.tsx      where money beats the snake, and where it does not
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
src/lib/projection.ts                 the projection model itself (shared)
src/lib/modelTrust.ts                 where the backtest says not to trust it
src/lib/consensusBoard.ts             the market's order, our dollars
src/lib/snakeOutlook.ts               what the snake gives free, so a bid has a bar
src/lib/endgame.ts                    par against pace: when to buy, not what
src/lib/marketContract.ts             what a market snapshot is (shared)
src/data/nfl/market-adp.json          live half-PPR ADP, keyed by gsis (generated)
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
scripts/backtest-projections.mjs      scores the model against seasons that happened
scripts/nflverse.mjs                  reading those files, shared by both
scripts/fetch-adp.mjs                 the draft market, refreshed on its own
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

**Two buttons, and the order they are pressed in changed the board.** Found
driving the owner's real sixty-name sheet, and the more dangerous of the two
because the wrong order is the natural one — press the recommended button, then
paste the sheet when the commissioner sends it.

"Use consensus" reads dollar values off our surplus curve for a board where the
money buys 192 players. Importing a sheet re-prices that curve for a board where
the same money buys sixty. The overrides then held the old numbers and won,
because `buildPlayer` prefers an override to the price it has just computed — so
the whole sheet read about 35% cheap. Gibbs showed $55 against the $94 the room
would actually pay: a board that loses every player while its owner believes he
is being disciplined. `setAuctionSheet` and `clearAuctionSheet` now re-derive a
market board after re-pricing, and `MARKET_BOARD_KEY` is what distinguishes
values we derived from values somebody stated. It is its own storage key rather
than a read of the overrides' `notes`, because a CSV with a notes column saying
"consensus" would otherwise have the owner's own numbers silently replaced.

The second bug was underneath it and only appears once a real sheet is in force.
The reorder is a **permutation of a value curve, and a permutation only conserves
money if it stays inside the set the money is spread across.** Reordering across
the sheet boundary handed a highly-ranked off-sheet player a real dollar value
and pushed a sheet player to the floor: $436 of the room's $2,400 leaked onto
fourteen players nobody was going to bid on, and the sheet itself came out $422
light. `ConsensusSubject.forSale` is what keeps the permutation inside the
auction; with no sheet it is everybody, which is why nothing showed until a
sheet existed. Four tests hold both orders to the same prices and the sheet to
the room's whole budget.

**A club abbreviation that is also a first name may not be admitted.** The same
real sheet wrote Arizona as "AZ", which was not in the alias map — and because
an unrecognised trailing token blocks the position token before it, "Trey
McBride TE AZ" failed to resolve a correctly spelled name. `AZ` and `PHL` are in
now. `PHIL`, `JACK`, `WASH` and `PITT` deliberately are not: a club token is
stripped out of the name, so admitting them would turn "Phil Dorsett" into
"Dorsett of Philadelphia" — a worse failure than the one it fixes, because it
resolves to somebody rather than to nobody.

**A paste can fail in the middle, and that is the one nobody catches.** The
import already names every ambiguous, unmatched, duplicated and skipped row,
and already refuses a list too concentrated to bid on. Between those sits the
failure `sheetLoss` exists for: a paste that loses a chunk out of the _middle_.
The top twenty still price perfectly sensibly, every check passes, and
`auctionSheetSize` is now forty rather than sixty — which has re-priced the
whole board for an auction the room is not holding. A count cannot carry that,
because twelve lost out of four hundred is a commissioner listing some defences
by nickname and twelve out of thirty is a broken paste. So it reports the share
and bands it at one row in eight, and hands back the text of every lost row to
be copied out, because the only useful thing to do with a broken paste is fix
it. The lists are no longer truncated at six and eight either: the panel said
"every one is listed above" while showing the first six, which is the one claim
a panel about lost names may not get wrong.

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

**A bargain board sorted on ranks leads with dollar players.** It sorted on
`market.edge`, a difference of _ranks_, which put a $2 bench receiver the
consensus has 160 places lower at the top of a panel about bargains. A hundred
and sixty places there is worth a dollar: below the top hundred both boards are
ranking noise, and the gap measures how little either of them knows rather than
how much money is on the table. The arithmetic also did not do what its own
comment said — it claimed the expected price tracks the market rank, computed
that price from _our_ value, and made up the difference with a bare
`edge * 0.12`, a constant nobody derived. `consensusOverrides` makes the
market's dollar opinion computable, so `gap` is now ours minus theirs in money,
the sort key is that, the projected cost is their number moved by the room's
inflation through the shared `inflatedPrice`, and the fudge is gone. Both `gap`
and the tie-break read `modelValue` rather than the live price, so pressing
"Use consensus" cannot re-derive the disagreement against itself and report
that we agree with everybody about everything.

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

**A flex used to change nothing at all, and the objection to fixing it is also
right.** `rostered` answers "how many of this position does the league own",
and roster size is fixed, so turning a flex on left all 628 prices identical —
measured, not suspected. The objection is that a flex genuinely does not make
the league own more players: twelve teams still own twelve times sixteen. What
it does is convert a speculative bench spot into one that has to be filled by
somebody startable, so the composition moves — a team carries one fewer lottery
ticket and one more flex-worthy back. The counts have room for exactly that,
because they sum to 170 of the 192 spots a twelve-team league fills, the balance
being deep fliers nobody would call rostered at a position.

Which positions absorb it is derived rather than typed. A fixed 45/45/10 split
is a guess that never moves and is wrong in both directions — in standard
scoring backs fill most flexes, in full PPR receivers do — so `flexDemand` ranks
every flex-eligible player at _this league's_ scoring, skips the ones the
dedicated slots already account for, and sees who the next ones actually are.
That makes the allocation follow `receptionPoints` for free, which is the whole
reason it cannot be a constant, and a test drives standard against full PPR to
prove it does. On the shipped pool at half PPR one flex sends eleven of the
twelve slots to backs and one to a receiver, drops RB replacement 101.2 to 91.1,
and moves 108 players: the top comes down $2-3 (Chase $48 to $45) and depth
backs go up $3 (Aaron Jones $1 to $4), which is what a flex does in a real room.
At zero flex it returns zeroes and is a no-op to the last cent — which is what
keeps the shipped pool's 628 values reproducible, and three tests fail if the
condition is removed.

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
model in `src/lib/projection.ts` — recency-weighted points per game, shrunk
toward a positional baseline by sample size, age-adjusted, times expected games.
It has been measured against three seasons it did not see, and it loses to the
draft market on what a bid actually buys; read "What the model is worth" below
before trusting a price. Dollar
values are value over replacement converted to a share of the league's budget.
Kickers and defenses are regressed hard because their scoring barely predicts
itself year to year, which is why they price out at a dollar or two.

Everything a player card shows traces to an observation: bye weeks and matchup
difficulty from the 2026 schedule, floor and ceiling from one standard deviation
of the season total, consistency from weekly variance, injury risk from games
actually missed, and percentiles from the position's own distribution.

**A kicker is a job, not a talent pool.** Every position was admitted by
projected points against a cap, which is right for a genuine pool and wrong for
a position where demand is exactly one per club. It produced 32 kickers spread
across 30 clubs — Miami and Indianapolis with two, Buffalo and New Orleans with
none — while all 32 clubs carry a kicker on the roster file. Two backups were
on the board and two starters were not, so the Bills' kicker could not be
nominated at all. `K` and `DST` now claim one seat per club first and the
ordinary cap fills what is left. It swapped exactly one player (Riley Patterson
out, Tyler Bass in) and moved not one price. New Orleans still has none, and
that is correct rather than a residue: their two kickers are a practice-squad
player and an undrafted rookie with no tape, so the job is genuinely open.

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

## What the model is worth

**Nobody had ever checked, and the answer is not the one the board wants.**
Every price here is a linear function of `projection.points` — VORP, the auction
value, the bargain board, the tier breaks, the advisor's entire case — so if the
model were worse than the cheat sheet the other eleven managers are holding, the
edge would run backwards and the honest advice would be to draft off consensus.
That was a real possible answer and it had to be reachable. `npm run backtest`
reached most of it: **on the measure that decides a bid, the market's board beat
this board in every season tested.**

**The model moved out of the builder so the backtest could measure it rather
than a copy.** `src/lib/projection.ts` is the fourth module of the shape
`valuation.ts`, `researchContract.ts` and `serverContract.ts` already have: one
definition, imported by a `.mjs` script through Node's type stripping and
reachable from the client tree, so two halves cannot come to disagree. A
backtest that reimplemented recency weighting and shrinkage would have scored
its own arithmetic, and a copy scoring well is evidence about the copy.
`scripts/nflverse.mjs` came out for the same reason one layer down: the backtest
adds up a player's _actual_ season, and if it did that with different scoring
from the projection, part of the reported error would be the gap between two
scoring systems with no way to say how much.

The extraction was proved rather than asserted. `build:pool` was run to a
staging directory before the change and again after; all four generated files
are identical apart from their timestamp, including all 628 auction values,
VORPs and replacement levels. A refactor of a projection model that moves one
number is a different model, and there would be no way to tell afterwards which
of the two the pool had been built with.

**How it is scored.** Three seasons are held out one at a time — 2023, 2024,
2025 — because one season can flatter or damn a model by the accident of one
year's injuries, and a finding that does not repeat is not a finding. For each,
projections are rebuilt from weekly production strictly before it (enforced on
the season number, not on which file a row came from), injuries from the season
before, and the draft classes the model's own window admits. The universe is
that season's _week-one_ roster; a season-long roster file knows who survived
the year. Points are restated to half PPR on both sides through `pointsFor`, so
projection and outcome are always compared under the owner's scoring.

The baselines are last season's actual points, a positional-mean floor, and the
market. **Historical FantasyPros consensus could not be found and is not faked**:
DynastyProcess publishes ECR as a single _latest_ snapshot
(`db_fpecr_latest.csv`, stamped 2026-08-21) with no dated archive, so what
FantasyPros said before a backtested season is not recoverable from the feed the
pool already uses. What stands in for it is Fantasy Football Calculator's public
ADP archive, taken at **half PPR** to match the league everything else here is
scored at — 4,576 twelve-team drafts in the week before the 2023 season, 906
before 2024, 718 before 2025. That is a market rather than a panel of experts,
which makes it a better proxy for what the room does and a worse one for what
FantasyPros says, and it is labelled ADP everywhere it appears. It carries no
ids, so it is matched on names under the same refusal to guess `rankingsCsv`
lives by; 161, 153 and 140 rows resolved into the universe, none ambiguously.
The full-PPR feed has eight thousand-odd drafts and was run too, since the
smaller sample is a real cost; every conclusion below is the same under it.

### The headline was wrong once, and how it was wrong is the useful part

The first version of this section led with Spearman against raw fantasy points,
pooled over every position, on the players the room was drafting, and reported
that the model was the best of the four in all three seasons — 0.510, 0.491,
0.564 against ADP's 0.470, 0.402, 0.432. Those numbers are real and are still
printed by the script. The conclusion drawn from them was backwards.

Pooling positions and ranking on raw points means most of that correlation is
_not_ "did this board sort the players". In half PPR a starting quarterback
outscores a starting running back by well over a hundred points, so any board
that knows quarterbacks score more gets paid for knowing it — and every board
knows, and no auction pays a dollar for it, because you start one. The proof is
sitting in the same table: the `position mean` floor, which gives every player
at a position the identical number and therefore cannot tell two receivers
apart by construction, scored 0.282, 0.358 and 0.306 on it. A measure a
constant scores a third on is measuring something other than the players.

What a bid buys is points above the man you could have had for a dollar at the
same position. `auctionValue` is a linear function of `vorp`, so surplus over
replacement _is_ the board's own ordering — which makes it, and not the pooled
table, the measure of the thing being sold. Scored that way the position-mean
floor scores nothing at all, exactly as it should, and:

| season | the model | last season | position mean | ADP (market) |
| ------ | --------- | ----------- | ------------- | ------------ |
| 2023   | 0.368     | 0.392       | —             | **0.533**    |
| 2024   | 0.378     | 0.329       | —             | **0.472**    |
| 2025   | 0.428     | 0.276       | —             | **0.486**    |

Asked one position at a time on the same players, the same answer: the market's
board sorted the position better in **11 of the 12 position-seasons** (model
against ADP — QB −0.065/0.290, 0.458/0.466, −0.030/**−0.079**; RB 0.338/0.386,
0.531/0.560, 0.629/0.710; WR 0.638/0.712, 0.207/0.447, 0.410/0.487; TE
0.110/0.375, 0.133/0.478, −0.114/−0.046). The one the model won it won by
0.05 on a position where both boards were scoring approximately zero.

So the pooled table is still printed, under the surplus table and under that
explanation, rather than deleted — because it is the number somebody will
otherwise recompute and be encouraged by.

### The other two findings, which point the same way

_Where the model departs most sharply from the market, the market is usually
right._ Taking the fifteen players each way whose model rank and ADP rank
disagreed most, the actual finish was nearer the market's rank on 20, 18 and 17
of 30, and the market's side of those disagreements was worth about twice as
much in hindsight dollars ($13.7 against $7.1 in 2023, $13.2 against $6.7 in
2024, $11.9 against $10.1 in 2025). Some of that is a selection effect — pick
any estimator's most extreme opinions and regression to the mean will punish
them — but the direction repeats across three seasons and so does the shape of
the names. The model's confident departures are veterans it is still paying for
old tape (Joe Mixon, Najee Harris, Brandon Aiyuk, Brian Robinson); the market's
are young players with a job and little history (Malik Nabers, Marvin Harrison
Jr., Xavier Worthy, Tetairoa McMillan).

_Over the whole field the model loses badly to last season's points_ — rho
0.556, 0.526, 0.514 against 0.629, 0.676, 0.661, and mean absolute error of
about 61 points against about 33. Almost all of that is one thing the baseline
can say and the model cannot: _this man will not play_. Last season's points
give a zero to the three hundred rostered players who are nobody, and most of
them are nobody again. The model shrinks everyone toward a startable baseline
and multiplies by expected games, which are discounted only for _injury_
absences, so a healthy fourth receiver who was active for six games is projected
for a full season's work. It over-projects the field by 43 to 48 points a man.
A roughly uniform inflation mostly cancels through replacement level and so
costs little in dollars — but it means the board's tail is not ranking players,
it is ranking positions.

### Where it is worst, specifically

By games of tape the projection saw, in 2023, 2024, 2025:

| tape          | rho                | over-projects by |
| ------------- | ------------------ | ---------------- |
| none (rookie) | 0.51 / 0.33 / 0.39 | +34 / +47 / +43  |
| 1-16 games    | 0.21 / 0.13 / 0.04 | +62 / +58 / +72  |
| 17-33 games   | 0.49 / 0.56 / 0.43 | +43 / +40 / +45  |
| 34+ games     | 0.68 / 0.75 / 0.65 | +41 / +23 / +27  |

A partial season of tape is the single worst input this model takes, every year,
and by a distance: at one to sixteen games it is doing nothing at all, while
last season's points score 0.52 to 0.58 on the same players. The mechanism is
visible in the arithmetic — six games at a high rate shrink to a respectable
rate against an eight-game prior, and then get multiplied by seventeen games
nobody has any reason to expect. It is also the bucket a draft room argues about
most, because a player with six good games is exactly what a sleeper is.

Tight end is where the board should be trusted least against the room: 0.110,
0.133 and −0.114 against ADP's 0.375, 0.478 and −0.046. By age, thirty-and-over
is the worst group (0.414 against last season's 0.753 in 2025): the age curve
discounts, but not nearly enough or early enough.

### In dollars it is a dead heat with last season's points

Priced through the same `pricePool` at 12 teams / $200 / 16 spots / half PPR,
over the 192 players who turned out to be worth owning, the model's price is off
by $8.18, $8.57 and $7.45 a man; last season's points are off by $7.76, $8.77
and $7.77. Three years of modelling buys a few cents. The disagreements are
large individually and cancel — in 2025 the model was closer on 9 of the twenty
biggest and last season on 10, right about Christian McCaffrey by $39 and wrong
about CeeDee Lamb by $18.

### Blending the two does not help, which was worth measuring

The obvious response to that table is an ensemble — two estimators with
uncorrelated errors usually average to something better than both — and it had
to be measured rather than assumed, because the obvious response to a table is
also what produced the wrong headline the first time.

ADP is a draft position with no points behind it, so a blend cannot be an
average of two numbers; it happens in rank space. Within each position, rank by
our surplus and by ADP, average the two ranks at weight `w`, then read the
blended rank back off our own sorted surplus curve. That last step is what makes
the result a _board_ rather than an ordering: the gaps between surpluses are
what turn into dollars, so the blend takes its order from both and its shape
from ours. Within position, because ADP pools positions and blending global
ranks walks straight back into the confound above.

Sweeping `w` and reporting the best one would be fitting three seasons and
scoring the same three. So the sweep is printed and labelled in-sample, and the
honest column is leave-one-season-out — the weight picked on the other two
seasons and scored on this one:

| season | w=0 (market) | 0.25  | 0.50  | 0.75  | w=1 (ours) | LOO picks |
| ------ | ------------ | ----- | ----- | ----- | ---------- | --------- |
| 2023   | **0.510**    | 0.497 | 0.444 | 0.398 | 0.368      | w = 0     |
| 2024   | **0.482**    | 0.464 | 0.449 | 0.409 | 0.378      | w = 0     |
| 2025   | 0.481        | 0.482 | 0.467 | 0.454 | 0.428      | w = 0     |

The curve is monotone and leave-one-out picks **zero weight on our own ordering
in all three seasons**. Averaging only helps when two estimators are comparably
good; ours is not, so the blend dilutes the better signal. A negative result,
and the one that decided what got built.

### The signal that was measured, and the one that shipped

Worth recording because it was a real hole rather than a refinement. The
backtest measured **ADP** — thousands of real half-PPR drafts from Fantasy
Football Calculator. The "Use consensus" button then shipped driven by
**FantasyPros ECR**, an analyst panel, purely because that is what the pool
happened to carry. Those are different signals, the substitution was never
measured, and they disagree exactly where it costs most: on the 2026 board live
ADP has Gibbs, Bijan, Nacua, Chase and consensus has Chase, Gibbs, Nacua,
Bijan — the four most expensive players in the auction.

So `market-adp.json` is now bundled beside the pool and ADP outranks consensus
wherever it exists. It does not _replace_ it: real drafts stop caring after
about 230 players where consensus ranks 383, so a player with a consensus rank
and no ADP is by definition one the room was not drafting, and he sorts after
every ADP'd player at his position. That is an ordering claim both sources
agree on rather than a splice of two incompatible scales — an ADP of 41.2 and a
consensus rank of 55 measure different things and their average is not a
quantity. `marketOrder` is the one place that rule lives, and the coverage the
panel reports is split by source so neither can claim the other's players.

`scripts/fetch-adp.mjs` is a separate script writing a separate file, and that
is the point. Once a market signal _drives_ the board its freshness stops being
housekeeping — pre-season ADP moves fastest in the fortnight before week one,
and those are precisely the moves the ordering is now taken from. The bundled
consensus can only be refreshed by `build:pool`, which downloads nineteen
megabytes of play-by-play; this is one small endpoint, so the number the board
is about to be priced from can be refreshed on the morning of the draft.
`marketAge` measures from the last day of drafts sampled rather than from when
the file was written, because re-downloading an unchanged file does not make
the market any newer, and a refresh reporting "fetched today" over week-old
drafts is the one reassurance this must withhold.

The join is on names, which is the single place in this codebase one has to be:
the feed carries no ids. It follows the rule `rankingsCsv` and `auctionSheet`
already live by — a name matching two players matches neither — and reuses the
backtest's own normaliser rather than a second one, because the backtest's
resolved rows are the only evidence this join works at all. On the shipped pool
that is 217 of 232 matched with none ambiguous; the fifteen misses are 2026
rookies and free agents nflverse's roster file does not carry.

### What this means on the night

`src/lib/consensusBoard.ts` is that decision as a button. It takes the ordering
from the consensus already bundled with the pool and the _dollars_ from us —
which is exactly the `w = 0` board measured above, and the second half is the
part easy to miss. A rank is not a price. What turns an ordering into dollars is
the size of the gaps between players, and consensus publishes a rank with no
gaps in it at all; our surplus curve has them, is derived from this league's own
scoring and roster shape, and is the one thing the backtest found the board is
genuinely good at. Permuting values along that curve keeps every dollar the
league had to spend and only changes who receives them, which a test asserts
position by position.

It reorders **within a position, never across**, for the same reason the
headline was wrong: a pooled consensus list ranks the best quarterback above
every receiver, and letting that cross positions hands the board the positional
ordering no auction pays for.

It is expressed as overrides and goes through `setCustomRankings` rather than
being a second pricing mode, because an imported CSV and the built-in consensus
are the same claim from different sources — somebody else's ordering, our
dollars — and a second path would be a second place a price is decided.
Everything the import already earns comes free: the advisor follows it,
`modelValue` keeps ours beside it, and a draft in progress survives it. It reads
`modelValue` rather than the live price so that applying it twice lands where
applying it once did; off the live price it would re-order an already re-ordered
board and drift a little further on every press.

The honest number is not 628. FantasyPros ranks 383 of them and the panel says
so; the other 245 keep our price, which is right rather than a gap — they are
the $1-2 bench players consensus does not bother to rank, they already sit at
the floor, and inventing a market opinion for them would be inventing the one
thing the whole module exists to defer to.

`src/lib/modelTrust.ts` is where that stops being a document and starts being
something the room can see. It holds the verdict line the bargain board leads
with and the three blind spots the backtest actually printed — one to sixteen
games of tape, thirty and over, tight end — and nothing else, because a caveat
nobody measured is indistinguishable on screen from the three that were and
spends their credibility. It renders in two places and they are chosen: the
bargain board, whose entire subject is the size of a gap, and the nomination
stage's name line, which is what somebody is looking at while money is on the
table. A finding that lives only in this file is a finding nobody has at the
moment a name is called.

It is deliberately not in `draftAdvisor.ts`. The advisor takes a position on a
player; this states a measured property of our own board, which is a fact and
belongs with the facts — and it carries no dollar figure for the same reason
`researchContract.ts` has no price field.

The board is not worthless and it is not an edge over the room's ordering. What
it is good at is the arithmetic nobody at the table is doing: converting a
ranking into dollars under _this_ league's scoring and roster shape, tracking
what is left at each position, and knowing what a bid leaves behind. Read it
that way.

- **A sharp disagreement with consensus is a reason to doubt the board, not a
  bargain.** This is the reversal of what the bargain board's framing implies,
  and it is the single most actionable line here. Three seasons, same direction.
- **Trust the room over the board at tight end**, and on any player with a
  partial season behind him or thirty-plus years on him. Those are the
  documented failure profiles, all three years.
- **Treat everything below the top hundred or so as position labels**, not
  rankings.
- **Press "Use consensus" and let the market drive.** It needs no file: the
  panel's first control re-prices the board at the bundled consensus, and
  `player.modelValue` keeps ours beside it. On this evidence that is the
  recommended way to run the night, not a fallback. An imported commissioner's
  sheet or a better ranking comes through the same door and overrides it.
- A dollar figure is worth about what last year's points would have said.

The script takes `--season` (one or a comma-separated list), `--offline` and
`--json`, so the whole thing re-runs against a fourth season the moment one
exists. Two limitations it does not hide: the universe filters on week-one
roster status, which is set after drafts happen, so a player cut in the final
week is out of every board's scoring alike; and ADP can be ranked but never
scored for error, so the MAE column is blank for it and compares only the boards
that emit points. Kickers and defenses are out of it entirely, for reasons the
file states — a defense never goes through `projectPlayer` at all, and
nflverse's pre-2025 weekly asset contains no kickers whatsoever, so every kicker
in a held-out season would arrive with no tape and score the no-tape fallback
while being reported as the model.

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
file or on the clipboard; and the model finally measured — extracted into
`src/lib/projection.ts` so a backtest scores the real one, run against three
held-out seasons against last-season points, a positional floor and real
draft-market ADP, with the answer written down as it came out rather than as it
was hoped for: on what a bid actually buys, the room's board beat ours in every
season, and the advice for the night changed accordingly, with the three blind
spots it named now flagged on the bargain board and beside the name on the
block, a flex that finally moves the prices it should, and the market's own
ordering one button away because a measured blend of the two was worse than the
market alone, a sheet paste that says how much of itself it lost and hands the
failures back to be fixed, a bargain board sorted by money rather than by rank,
73,407 lines of dead tree finally gone, and the board finally ordered by the
signal that was actually measured — live half-PPR ADP, refreshable on its own in
seconds, with expert consensus extending it past where real drafts stop;
618 tests.

The CSV download used to do nothing inside the published artifact, whose
sandbox blocks any save a page starts itself. `src/lib/saveFile.ts` now goes
through the viewer's `downloads` capability where there is one and stays an
anchor everywhere else, so one call site serves both. `csv` is in that
capability's extended set and can be refused, in which case the same bytes go
out as `.txt`.

Open, roughly in order of value:

1. **A draft shared beyond one browser.** Two windows on one machine stay in
   step (`draftSync.ts`), which covers the laptop-and-television case. The
   optional server does _not_ extend that and was not built to: it stores copies
   of the draft, it does not carry one, and nothing about whose turn it is
   travels through it. Making it authoritative would mean a second place the
   draft lives and a second place the rules would have to be enforced — the two
   things the pick-log-is-the-only-shared-fact rule exists to prevent — so it is
   a real design change rather than a route to add. The published artifact
   cannot have it either way: its CSP blocks every external host.

**Money left over players left is a constraint, not a forecast, and it decides
when to buy.** `snakeOutlook` says _what_ a dollar buys; `endgame.ts` says
_when_ it goes furthest. Twelve teams at $200 chasing sixty players means the
sheet averages $40 whatever anybody believes, so if the first twenty go at $60
the remaining forty must average $30 — the money is gone and the players are
not. Every auction ends in a fire sale for that reason and the only question is
who is holding money when it starts. The panel prints **par** (what the
remainder must average) beside **pace** (what the room has lately paid, over the
last eight sales only, because an average across the whole auction is dominated
by the opening stars and stops moving). Driven on the owner's real sheet: par
opens at $44, and after eight sales at $75-95 it reads "the room is paying $84
against a par of $37 — the last 47 have to come down", with his share of the
remaining money up from 8% to 12% for doing nothing.

The count of teams that can still cover par short-circuits that comparison, and
deliberately: a team with $8 left is not a quiet bidder but a spectator, and
once most of the room is spectating what a player is worth stops mattering. It
lives in `MarketPanel` beside inflation rather than in a panel of its own,
because both are readings of the same thing — how much money is chasing how few
players — and two panels would let the room find two answers to one question.

**What the snake gives you free is what a bid is competing with, and `vorp` is
the wrong bar for it.** This is the one piece of arithmetic here that is
specific to the format, and it is the piece nobody else at the table is doing.
In an ordinary auction every roster spot has to be bought, so the only question
is how to divide the money. Here fifty-odd are bought and eleven or twelve seats
a team are snaked for nothing, with no minimum anybody must spend — so the
question is not what a player is worth, it is how much better he is than the man
you get for free at the same position.

VORP cannot answer that, and the reason is worth stating rather than treating
this as a refinement of it. VORP measures against the last man the _league_
rosters — about the sixtieth receiver — which is right when the auction buys the
whole roster, because then he really is the alternative. Here he is not: the
alternative is whoever survives to _your_ snake slot. Paying for the gap to the
sixtieth receiver when you are only buying the gap to the twenty-fifth is how a
budget disappears into players nobody needed to buy.

`snakeOutlook` takes two orders and **using one for both is the mistake the
whole module exists to prevent**. Who is _gone_ is the room's call, so it comes
off the room's order — the market's, through the same `marketOrder` the
consensus board uses, because every off-sheet player is priced at the dollar
floor by construction and price cannot order the snake pool at all. Who _you
take_ from what is left is your call, and you take the best of them by projected
points. Ordering both by the room inflates the gain, sometimes wildly: on the
shipped board it made the best free back a rookie the market likes and this
model does not, at 61 points, when a back worth two and a half times that was
sitting untaken beside him — and the auction then looked like the only way to
get a running back, which is exactly the conclusion a budget should not be spent
on. The corrected numbers at half PPR with one flex, picking third: RB and WR
buy 1.4 points a dollar, quarterback and tight end 1.1, and Josh Allen at $63
buys seventy-one points over a Dak Prescott the snake hands you.

It refuses rather than guesses on every input it lacks — no sheet, no team
marked as yours, no snake order — because an outlook computed without knowing
where you pick is an outlook for somebody else's draft and looks exactly as
authoritative as a real one. The same number is pointed at the man on the block
from the nomination stage, since that is where it is needed while money is on
the table.

**A seat you have already filled is not a seat.** The gain was computed against
the best free man at the player's _position_, which is the right bar exactly
until your own slots at it fill — and then it is a number about a seat that is
taken. Two running backs in and the board went on quoting the gap to the best
free back for every back after that, which is the specific way this format is
lost: the third back is not competing with a back, he is competing for your
flex against every position that can fill it, and the fourth is a bench body.
`gainOverSnake` therefore reads your own roster through the same
`unfilledSlotsFor` the reserve uses, and returns which of the three it is
alongside the number. Bench is `gain: 0` with no free man named, because there
is nobody to name: the snake hands you eleven bench bodies for nothing, so the
alternative to buying him is any of them.

**Two claims on one screen may not point opposite ways, and this one was found
by looking.** The stage said "Bench only — he is a bench player and adds nothing
to the lineup that scores", and an inch above the sold button, "Below value" in
green. Both sentences were true. The price comparison is against the _league's_
bar — points over the last man the league rosters — and a bench body really can
sit under it. What is not true is that beating it is a reason to bid, and green
beside a bid box is nothing but a reason to bid. The same thing happens without
a full roster whenever the gain is negative: "Buying him gains −35 pts over
Jonathan Taylor, free in the snake" under a green "Below value" is the sharper
version, because there the seat is open and paying is still a measured loss.

So `verdictFor` takes the snake gain and withholds the _tone_ rather than
changing the words — the comparison still says Below value, in the colour of
something that is not an argument, with one quiet line saying which lineup it
is talking about. An overpay is deliberately left alone: it is already the
loudest warning on the panel and muting it would be the same mistake pointed
the other way. Four tests pin the relationship rather than the wording, because
what must never come back is the green, not the phrasing.

**A player the room drafts and the pool has never heard of is still draftable.**
nflverse's roster file lags signings, so Keenan Allen, Stefon Diggs and Deebo
Samuel were inside the top 230 of real drafts and absent from a pool built the
same week — and a player the room is taking that this board cannot even put on
the block is the worst shape a gap can take on the night. `fetch-adp` keeps them
in the snapshot's `absent` list rather than dropping them, and the engine builds
them into the board.

The load-bearing part is _where_: they are appended **after** `pricePool` has
run, so they are never in the array `replacementLevels` sees. A player with no
projected points inside that arithmetic would drag his position's replacement
level down and move every price on the board on the strength of a number nobody
has. They cost the board nothing and are simply also on it.

That leaves them at the dollar floor until the market board is applied, which is
honest rather than convenient: $1 is not a claim about Keenan Allen, it is where
every player we cannot price sits. `consensusOverrides` then slots him onto his
position's curve at the rank real drafts give him — WR60, as it happens, which
is why he prices at a dollar anyway. The gain here is nominability, not price:
these are all late-round names, and the point is that a commissioner's sheet
naming one does not hit a board that has never heard of him.

**Where an unrankable player sorts is a design decision, and getting it wrong
cost the whole first impression.** The fourteen market-only players were given
`adp: 0`, and the board's default sort reads `adp` directly — so the app opened
on a wall of twelve cards with no projection, no rank and no price, made of
exactly the players we know least about. Worse, each carried a four-line
paragraph explaining itself, which made them the loudest thing on screen. They
now sort behind everybody we can price (`MARKET_ONLY_RANK`), and the paragraph
is a one-word `no data` chip beside the `snake` marker it sits next to, with
the explanation on hover and in full on the nomination stage where a bid is
actually decided. Nothing about the arithmetic changed; the board went from
unusable to correct on one number and one element.

`Player` requires numbers on a dozen headline fields, so widening them to null
for fourteen players would be a large change to the type every panel reads.
Instead `marketOnly` carries "we know nothing", and the rule it buys is that no
panel may print one of those placeholder zeroes. The card and the nomination
stage both show `—` and say why; the stage matters most, because "Projected 0"
beside a bid box reads as a measurement and the measurement does not exist.

## The night, driven end to end

The whole thing has been driven in a browser at the league actually being
played — twelve teams, $200, sixteen spots, **half PPR with one flex** — rather
than at the defaults. In order: the first-run gate set to half PPR and a flex;
"Use consensus" repricing 390 of 628 (218 from real drafts, 172 from expert
consensus where drafts stop); a fifty-name sheet pasted and resolved 50/50 with
nothing ambiguous, unmatched or duplicated; all fifty sold through the keyboard
path; the phase moving to the snake by itself when the sheet emptied; nineteen
snake picks, **none of them carrying a cost**; and no console error anywhere
across sixty-nine picks.

The run ends where it should. The driver takes whatever is top of the board
regardless of who is on the clock, so it eventually offered a fourth tight end
to a team holding three, and the stage refused it in words — "Team 5 cannot
carry more than 3 at TE" — with the draft button disabled rather than accepting
and rejecting afterwards. That is `checkRoster` doing its job through
`validateSnakePick`, and it is the correct end to that particular script rather
than a defect. Visible in the same frame: Mark Andrews carrying both the `age
31` and `tight end` blind-spot chips from `modelTrust`, and the card marked
"snake" where a price would be.

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
It also sets `__DV_OFFLINE__`, which `refreshIdentity` reads and returns on
immediately: the live merge asks ESPN for all 32 rosters, and there every one of
those is a request that can only fail and be printed to the console. Driving the
built page with every external host blocked took it from 32 attempts to one —
the Google font, which is on the viewer's allowlist. The bar is the same one the
server's discovery is held to: not that the failure is caught, but that no
request was made.

The whole flow has been driven that way — the first-run gate, a fifty-name sheet
import, a sale, and a research tab with its sources — served from a static file
with everything but its own origin refused. Sixty cards, thirty-seven research
marks, no errors.

Two traps that file exists to remember. Vite puts the module script in `<head>`,
and the single-file build inlines the whole 2 MB bundle there — extracting only
`<body>` yields a page containing an empty `<div id="root">` and nothing else.
And the bundle registers a service worker, which is useless in a self-contained
page and logs a CSP error on every load, so the prelude shadows
`navigator.serviceWorker` before the bundle runs.

The app itself hotlinks the ESPN CDN and commits no images; `.cache/images/`
holds what the artifact build has already fetched.
