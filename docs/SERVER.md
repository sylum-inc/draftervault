# The optional server

Draft Vault runs as a static front end with no backend. This is the _optional_
server that sits beside it. Everything below is an extra; with it stopped the
app is exactly what it is without it, which is how the published artifact runs
permanently and what draft night falls back to if anything goes wrong.

What it adds:

- **Saved drafts with a version history.** Every save is a new immutable file,
  so no state of the draft is unreachable.
- **An autosave.** Once a draft is bound, every pick writes a version a couple
  of seconds after it lands.
- **Server-side rebuilds.** `build-player-pool.mjs` and `research-players.mjs`
  started over HTTP, with their output polled back into a panel.
- **Somewhere for the OpenRouter key** that is not the browser bundle.
- **One origin.** It can serve `dist/`, so the app and the API share an origin
  and a single tunnel exposes both.

---

## Quick start

On the laptop that will run the auction:

```sh
npm ci
npm run build          # so the server has a dist/ to serve
npm run server         # http://127.0.0.1:8788
```

Open `http://127.0.0.1:8788`. The server injects a
`<meta name="draft-vault-server" content="/api">` into the page it serves, so
the app finds it with nothing to configure. Click **Server** in the toolbar to
name a draft and start backing it up.

With `npm run dev` instead (vite on :8080, the API on :8788), the page is not
served by the server, so tell it where to look — either open the Server panel
and type `http://127.0.0.1:8788/api`, or build with
`VITE_DRAFT_SERVER=http://127.0.0.1:8788/api`. The dev server also needs to be
allowed through CORS:

```sh
DRAFT_VAULT_ORIGINS=http://localhost:8080 npm run server
```

(Loopback origins are allowed automatically when the server is itself bound to
loopback, so in practice this is only needed if you have moved the host.)

---

## Environment

| Variable              | Default                | What it does                                                                |
| --------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `DRAFT_VAULT_HOST`    | `127.0.0.1`            | Interface to bind. Anything but loopback **requires** a token.              |
| `DRAFT_VAULT_PORT`    | `8788`                 | Port.                                                                       |
| `DRAFT_VAULT_TOKEN`   | _(none)_               | Shared bearer token. Required on every route but `/api/health`.             |
| `DRAFT_VAULT_DATA`    | `.draft-vault-data/`   | Where drafts and job output are written.                                    |
| `DRAFT_VAULT_NAME`    | the machine's hostname | Shown in the panel, so two tunnels are tellable apart.                      |
| `DRAFT_VAULT_ORIGINS` | _(none)_               | Comma-separated CORS allowlist. Unnecessary when the server serves `dist/`. |
| `OPENROUTER_API_KEY`  | _(none)_               | Enables the research job. Never returned by any route.                      |

---

## Exposing it through a tunnel

Leave the host at `127.0.0.1` and point a tunnel at it. A tunnel runs on this
machine and connects _outward_, so loopback is reachable through it and
unreachable from the room's wifi. Binding `0.0.0.0` buys nothing the tunnel does
not already give and hands the local network a copy.

```sh
DRAFT_VAULT_TOKEN=$(openssl rand -hex 24) npm run server
cloudflared tunnel --url http://127.0.0.1:8788
# or: ngrok http 8788
```

Then open the tunnel URL, click **Server**, and paste the token.

The server refuses to start on a non-loopback host with no token. There is no
combination of environment variables that produces an unauthenticated server on
a public interface.

### What the token actually protects, and what it does not

This is one person behind a tunnel, and the auth is honest about that: a shared
token, not accounts. Be clear about what that means, because the tunnel URL _is_
on the public internet.

**Anyone who learns the tunnel URL and the token can:**

- read, overwrite and delete every saved draft on that server;
- start a pool rebuild (bandwidth and CPU on your laptop);
- start a research run, which spends your OpenRouter credit.

**They cannot:**

- read the OpenRouter key, or any prefix or length of it. No route in the
  contract returns it; the handshake reports a boolean.
- read the shared token back out of anything.
- run anything other than those two scripts, or pass an argument to either. The
  options are a closed typed set and `jobArgs` composes the whole command line
  from strings it wrote itself.
- reach the store without the token at all. Without it they get the handshake —
  name, contract version, whether a token is wanted, which jobs exist — and
  nothing else.

**And the draft is never at risk from any of it.** The draft being played lives
in the browser's localStorage. The server holds copies. Deleting everything on
the server does not touch the auction in progress.

Practical advice: generate a fresh token per draft night (`openssl rand -hex
24`), stop the tunnel when you are done, and prefer a tunnel that can be shut
off to a permanently exposed port.

### CSRF

There is none to worry about, by construction rather than by mitigation.
Authentication is a bearer header a caller attaches on purpose, not a cookie a
browser attaches for them, and `Access-Control-Allow-Credentials` is never sent.
A hostile page in another tab cannot act as you even if it knows the address.

---

## Rebuilds write to a staging directory

Neither job writes over `src/data/nfl`. A fresh pool changes every price on the
board and a draft in progress was bid at the old ones. The panel prints where
the output went; move it in deliberately, between drafts, and rebuild:

```sh
cp .draft-vault-data/artifacts/<job-id>/*.json src/data/nfl/
npm run build
```

The research job is seeded from the current `src/data/nfl/research.json` before
it starts, so it keeps the merge-and-skip behaviour that makes a run which dies
at player 400 worth 400 players.

Only one job runs at a time. Both saturate the network or the CPU and both write
files.

---

## The store on disk

```
.draft-vault-data/
  drafts/<id>/meta.json     name, timestamps, the version index
  drafts/<id>/v0001.json    one version: its summary and the payload
  artifacts/<job-id>/       whatever a rebuild wrote
```

Plain JSON, one directory per draft, one file per version. `cat` reads it, `cp`
copies it, a USB stick carries it. A payload is the exact text `exportDraft()`
produced and the server never parses it — recovering a draft by hand is
`jq -r .payload .draft-vault-data/drafts/<id>/v0007.json > draft.json` and then
loading that file through the ordinary **File** panel.

---

## The API

Everything lives under `/api`. Shapes are defined in
`src/lib/serverContract.ts`, which the server imports through Node's type
stripping — the same file the browser imports, so the two halves cannot drift.

| Route                             |                                                         |
| --------------------------------- | ------------------------------------------------------- |
| `GET /api/health`                 | The handshake. The only route that never needs a token. |
| `GET /api/drafts`                 | List saved drafts.                                      |
| `POST /api/drafts`                | Create one. `{ name, payload, note }`                   |
| `GET /api/drafts/:id`             | One draft with its version history.                     |
| `PUT /api/drafts/:id`             | Add a version. `{ payload, note }`                      |
| `PATCH /api/drafts/:id`           | Rename. `{ name }`                                      |
| `DELETE /api/drafts/:id`          | Delete it and every version.                            |
| `GET /api/drafts/:id/versions/:n` | One version, with the payload.                          |
| `GET /api/jobs`                   | List jobs this process has run.                         |
| `POST /api/jobs`                  | Start one. `{ kind: "pool" \| "research", options }`    |
| `GET /api/jobs/:id?since=N`       | State plus the log lines after `N`.                     |
| `POST /api/jobs/:id/cancel`       | Stop a running job.                                     |

Writes must carry `X-Draft-Vault-Contract`. A request whose contract number
differs from the server's is refused before it can write, and the client refuses
to talk to a server on a different version at all — the two halves ship from one
git checkout, so a mismatch always means one of them was not restarted after a
pull.

By hand:

```sh
curl -s localhost:8788/api/health
curl -s -H "Authorization: Bearer $DRAFT_VAULT_TOKEN" localhost:8788/api/drafts
```

---

## Turning it off

Stop the process. The app carries on: the pool is a bundled file, the draft is
in localStorage, a second window still follows over the BroadcastChannel, and
**File → Save** still writes a draft you can carry to another machine. The
Server panel will say the server did not answer, the autosave will give up after
three tries and say the draft is safe in this browser, and nothing else changes.

To make the app forget the server entirely, open the panel and press
**Disconnect**.
