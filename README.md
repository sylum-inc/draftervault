# Draft Vault

A fantasy football **auction draft** board: 60 ranked players with valuation
analytics, 12 team budgets, live bid execution, and an auto-draft simulator. It
is a pure front-end app — a static bundle with no backend, no database, and no
API keys required to run it.

There is also an **optional** server (`npm run server`) for saved drafts, draft
history and server-side data rebuilds. It is strictly additive: the app works
exactly the same with it stopped, which is how the published build runs and what
draft night falls back to. See [docs/SERVER.md](docs/SERVER.md).

---

## Quick start (local)

```sh
npm ci
npm run dev            # http://localhost:8080
```

Production bundle:

```sh
npm run build          # -> dist/
npm run serve          # serves dist/ on http://0.0.0.0:4173
```

---

## Running it on a server

### Option 1 — Docker (recommended)

Everything needed is in the repo: multi-stage `Dockerfile` (Node build → nginx
runtime) and `nginx.conf` with SPA fallback and cache headers.

```sh
docker compose up -d --build          # http://<server-ip>:8080
```

or without compose:

```sh
docker build -t draft-vault .
docker run -d --name draft-vault -p 8080:80 --restart unless-stopped draft-vault
```

Put a TLS-terminating reverse proxy in front of it for anything public. With
Caddy that is a two-line `Caddyfile`:

```
draft.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

### Option 2 — Any static host

`npm run build` produces a plain static `dist/`. Upload it to Netlify, Vercel,
Cloudflare Pages, GitHub Pages, S3 + CloudFront, or any nginx/Apache docroot.

One requirement: the app is a single-page app, so **unknown paths must fall back
to `index.html`**, otherwise a refresh on any route 404s. `nginx.conf` in this
repo does that with `try_files $uri $uri/ /index.html`.

If the host cannot be configured to rewrite (GitHub Pages, a plain file share),
build with hash routing instead — it needs no server-side rewrites at all:

```sh
VITE_ROUTER=hash npm run build
```

### Option 3 — Single self-contained HTML file

```sh
npm run build:single   # -> dist-single/draft-vault.html (~0.65 MB)
```

One file with all CSS and JS inlined and hash routing enabled. Open it straight
from disk, email it, or drop it on any host — no server or build step needed.
Web fonts are the only network request; without them it falls back to the
system monospace face.

> On Windows use `npx cross-env SINGLE_FILE=true VITE_ROUTER=hash vite build`,
> since the npm script sets the variables the POSIX way.

---

## Configuration

Copy `.env.example` to `.env`. Every variable is optional — the draft board runs
with none of them set.

| Variable                                   | Purpose                                    |
| ------------------------------------------ | ------------------------------------------ |
| `VITE_APP_ENV`                             | `development` \| `staging` \| `production` |
| `VITE_SENTRY_DSN`                          | Error reporting (disabled when unset)      |
| `VITE_ROUTER`                              | `hash` to switch off history routing       |
| `VITE_RAPIDAPI_KEY`, `VITE_SPORTSDATA_KEY` | Reserved for NFL data providers            |

`VITE_*` values are compiled into the JavaScript bundle and are readable by
anyone who loads the page. Never put a private key in one — the same applies to
Docker `--build-arg` values, which are baked in at build time.

---

## Using the draft room

|                  |                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nominate**     | Click any card. The player takes the stage on the right (a bottom sheet on phones) with their valuation and bid controls                                  |
| **Sell**         | Pick the winning team, set the bid, hit `Sold`. Illegal bids are refused with the reason — over budget, position full, roster full, or not a whole dollar |
| **Undo**         | `Undo pick` in the top bar reverses the last sale, money and roster slot included                                                                         |
| **Filters**      | Search by player or team, filter by position, sort by ADP, value or projection                                                                            |
| **Full profile** | Real bio (jersey, age, height, weight, college, experience), the full valuation ladder, and risk factors                                                  |

Drafts save themselves. Close the tab mid-auction and the next visit replays
every pick, so nothing is lost to a stray refresh.

---

## Where the player data comes from

Names, teams, colors, crests, headshots and defensive personnel come from
ESPN's public API. `npm run fetch:nfl` regenerates the curated snapshot in
`src/data/nfl/`, which ships in the bundle so the board is populated before any
network request happens. At runtime the app quietly refreshes injury status and
team changes on top of that snapshot, and falls back to it whenever ESPN is
unreachable.

The generator also reports where the auction pool disagrees with ESPN — a
misspelled name, or a player the pool still lists on last season's team. Those
entries are flagged in the app rather than silently papered over.

---

## Development

```sh
npm run validate       # type-check + lint + tests
npm run test:coverage
npm run format
```

---

## Editing this project in Lovable

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/47607c7f-7118-443b-bb20-99ee80cb7bd6) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/47607c7f-7118-443b-bb20-99ee80cb7bd6) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
