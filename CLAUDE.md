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
npm run fetch:nfl    # regenerate team colors, crests and defensive units from ESPN
npm run build:pool   # rebuild the 599-player pool from nflverse production data
docker compose up -d --build     # nginx on :8080
```

## Architecture

```
src/pages/Index.tsx
  └── components/draft-room/DraftRoom.tsx     layout, filters, draft flow
        ├── PlayerCard.tsx        board card: headshot, team color, tier
        ├── PlayerTable.tsx       dense sortable board for 599 players
        ├── NominationStage.tsx   player on the block + bid controls
        ├── NominationClock.tsx   whose turn, how long they have had
        ├── BudgetRail.tsx        money left per team
        ├── TeamsPanel.tsx        every roster and its open slots
        ├── MarketPanel.tsx       inflation, supply, what the room pays
        ├── PlayerProfile.tsx     five tabs: overview, production, usage,
        │                         schedule, value (unit, for defenses)
        ├── charts/               RangeBar, PercentileBars, SeasonMultiples,
        │                         ScheduleStrip, BidLadder
        ├── DraftResults.tsx      grades and export
        ├── Sparkline.tsx         one season, game by game
        └── Headshot.tsx          photo with monogram fallback

src/hooks/use-draft-preferences.ts    view, watchlist, queue, clock length

src/services/auctionDraftService.ts   the draft engine (rules, bidding, state)
src/services/nflIdentity.ts           team colors, crests, headshots
src/data/nfl/pool.json                599 players: projections, values (generated)
src/data/nfl/player-history.json      per-player season and weekly scoring (lazy)
src/data/nfl/schedule.json            2026 season by team, with matchup difficulty
scripts/build-player-pool.mjs         builds the pool from nflverse
scripts/fetch-nfl-data.mjs            builds team identity from ESPN
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

**Identity is two-tiered.** The bundled snapshot in `src/data/nfl/` paints first
with real names, colors and faces and needs no network; `refreshIdentity()` then
merges live injury/team updates from ESPN over it and silently falls back to the
snapshot on any failure.

## Data provenance

Three free sources, joined on nflverse's id crosswalk, which resolves all 599
players with no name matching: **ESPN** for team colors, crests and headshots,
**nflverse** for rosters and production, **Sleeper** for market signal.

**The pool is generated, not typed.** `scripts/build-player-pool.mjs` builds 599
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

**Percentiles are how a number becomes meaningful.** Sixty per cent of snaps is a
committee back and a workhorse tight end, so every headline figure carries its
rank within its position.

Legacy services under `src/services/` named `real*` still generate numbers with
`Math.random()`. Nothing live reads them. Don't build on them.

## Conventions

- A `lint-staged` pre-commit hook runs `eslint --fix` and `prettier --write`, so
  commits touching an unformatted legacy file will reformat it. Expected.
- `npm run lint` reports ~78 pre-existing `no-explicit-any` errors in the older
  files. Don't add more; fixing them is a separate cleanup.
- Web fonts load from `index.html`, never via `@import` in a stylesheet that ships
  in a lazy route chunk — Vite's chunk loader waits on the stylesheet's load
  event, so an unreachable font host leaves the app on its loading screen forever.
  That bug was real; the comment in `bloomberg-terminal.css` explains it.
- `VITE_*` values are compiled into the bundle and readable by anyone. No secrets.
- The published artifact's `<head>` is not ours, so the single-file page carries
  its own `<meta name="viewport">`. Without it a phone assumes a 980px page and
  scales the whole app into a letterbox — which is exactly what happened once.

## State of the work

Done: the draft room (card and table boards, nomination clock, bid validation,
undo, persistence), a 599-player pool built from real production with
projections and auction values, player profiles with three seasons and a weekly
sparkline, defensive personnel for all 32 teams, a live market read, roster and
needs tracking, results with grades and export, Docker/nginx deployment, a
single-file build, 55 tests.

The one caveat worth knowing: the CSV **download** works in a browser but does
nothing inside the published artifact preview, whose sandbox blocks
page-initiated downloads. Copy CSV and Print work everywhere.

Open, roughly in order of value:

1. **League configuration.** Twelve teams at $200 with a fixed roster shape is
   hardcoded in both the engine and the pool builder's `LEAGUE` constant. The
   dollar values depend on it, so the two must stay in step.
2. **Dead code**: ~59k lines unreachable from `main.tsx`, about 40k of it
   `src/data/playerDatabase/`. Now that the pool comes from nflverse, that tree is
   genuinely redundant rather than salvageable — as are the Bloomberg interface,
   the orphaned AI stack and the unused shadcn components.
3. **No CI.** `npm run validate` gates nothing on push. Also `@sentry/react` and
   `web-vitals` are imported by `src` but declared as devDependencies, and
   `index.html` references `/icons/*` files that do not exist.

## Related

The published preview artifact lives at
https://claude.ai/code/artifact/7e72b3fa-0f58-46c9-8246-f3231e16849e — republish it
by passing that URL to the Artifact tool so the link stays stable. It embeds
headshots as data URIs because its sandbox blocks external hosts; the app itself
hotlinks the ESPN CDN and commits no images.
