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
npm run fetch:nfl    # regenerate the NFL data snapshot from ESPN
docker compose up -d --build     # nginx on :8080
```

## Architecture

```
src/pages/Index.tsx
  └── components/draft-room/DraftRoom.tsx     layout, filters, draft flow
        ├── PlayerCard.tsx        board card: headshot, team color, tier
        ├── NominationStage.tsx   player on the block + bid controls
        ├── BudgetRail.tsx        money left per team
        ├── PlayerProfile.tsx     full profile modal
        └── Headshot.tsx          photo with monogram fallback

src/services/auctionDraftService.ts   the draft engine (pool, teams, rules)
src/services/nflIdentity.ts           real player/team identity
src/data/nfl/*.json                   curated ESPN snapshot (generated)
scripts/fetch-nfl-data.mjs            regenerates that snapshot
src/styles/draft-room.css             design tokens + component styles
```

**The draft engine owns the rules.** `validateBid()` returns a typed rejection the
UI renders verbatim; `draftPlayer()` re-checks it. Bids must be whole dollars ≥ 1,
within budget minus a $1 reserve per unfilled starting slot, and inside the
position and roster limits. Picks persist to `localStorage` and replay on load —
only the picks are stored, so derived numbers always come from current logic.

`getPlayers()` and `getTeams()` return **fresh arrays** deliberately. An earlier
interface handed back the same array reference and mutated it in place, so React
never saw a change and drafted players stayed on the board. Don't "optimize" that
back.

**Identity is two-tiered.** The bundled snapshot in `src/data/nfl/` paints first
with real names, colors and faces and needs no network; `refreshIdentity()` then
merges live injury/team updates from ESPN over it and silently falls back to the
snapshot on any failure.

## Data provenance

Everything in `src/data/nfl/` comes from ESPN's public API via `npm run fetch:nfl`.
59 of the 60 pool entries resolve to real athletes. The matcher reports the rest
rather than guessing, and the app shows a "roster mismatch" banner on them:

- `P. Nuka` → Puka Nacua and `J. Connor` → James Conner are pool misspellings.
- A.J. Brown, Kenneth Walker III, Davante Adams, Mike Evans and DJ Moore are
  listed on the wrong teams — the pool was built on rosters two seasons old.
- `T. Hill (MIA)` matches no player on any current roster.

**The valuation numbers are not real.** `estimatedValue`, `projectedPoints`, `adp`
and VORP are hand-typed values from the original pool. Several services under
`src/services/` named `real*` generate their "analytics" with `Math.random()`.
Don't present those as fact, and don't build on them without replacing them.

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

## State of the work

Done: the draft room UI, real identity data, bid validation, undo, persistence,
Docker/nginx deployment, a single-file build, and 15 engine tests (55 total).

Open, roughly in order of value:

1. **Pool is not draftable.** 60 players, no kickers, no defenses, only 3 TEs.
   `src/data/nfl/defense-units.json` already holds real defensive personnel for all
   32 teams, and `PlayerInsights.tsx:319` has a defense-specific profile that
   nothing can currently reach because no DST exists in the pool.
2. **Replace the fabricated valuations** with real projections and ADP.
3. **The old tabs** — AI Insights, Team Builder, Analytics — still exist as
   components but are no longer routed, and need the draft-room design treatment.
4. **Dead code**: ~59k lines unreachable from `main.tsx`. About 40k of that is
   `src/data/playerDatabase/`, which is raw material worth wiring in rather than
   deleting; the Bloomberg interface, the orphaned AI stack and unused shadcn
   components are genuinely removable.
5. **No CI.** `npm run validate` gates nothing on push.

## Related

The published preview artifact lives at
https://claude.ai/code/artifact/7e72b3fa-0f58-46c9-8246-f3231e16849e — republish it
by passing that URL to the Artifact tool so the link stays stable. It embeds
headshots as data URIs because its sandbox blocks external hosts; the app itself
hotlinks the ESPN CDN and commits no images.
