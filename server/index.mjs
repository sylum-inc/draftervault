#!/usr/bin/env node
/**
 * The optional server: an overlay on a static app, never a dependency of it.
 *
 *   node server/index.mjs
 *
 * Everything Draft Vault does on draft night it does with this process stopped.
 * The pool is a bundled file, the draft lives in localStorage, a second window
 * follows over a BroadcastChannel, and a draft file is the escape hatch. This
 * adds four things on top and takes none away: saved drafts with a version
 * history, the two batch scripts startable over HTTP with their progress
 * readable, somewhere for the OpenRouter key to live that is not the bundle,
 * and — because it can also serve `dist/` — a single origin the whole lot can
 * be tunnelled through.
 *
 * ── Where it listens, and why that is the interesting decision ──────────────
 *
 * The default bind is 127.0.0.1. That is not timidity: the tunnel does not need
 * anything else. `cloudflared tunnel --url http://127.0.0.1:8788` and `ngrok
 * http 8788` both run on this machine and connect *outward*, so a loopback bind
 * is reachable through the tunnel and unreachable from the café wifi the laptop
 * is sitting on. Binding 0.0.0.0 buys nothing the tunnel does not already give
 * and hands the room's network a copy.
 *
 * Binding anything but loopback without DRAFT_VAULT_TOKEN is refused at
 * startup. There is no combination of environment variables that produces an
 * unauthenticated server on a public interface, because the moment that exists
 * somebody reaches it by accident at eleven at night.
 *
 * ── CORS ───────────────────────────────────────────────────────────────────
 *
 * A tunnel means the browser's origin is not localhost, so the ordinary answer
 * — "allow localhost" — is wrong here. The answer this takes instead is to
 * remove the cross-origin case: when `dist/` exists this process serves it, so
 * the page and the API share an origin and CORS never comes up. The allowlist
 * is for the one case that remains, `npm run dev` on :8080 talking to :8788,
 * and it is an explicit list in DRAFT_VAULT_ORIGINS plus loopback origins when
 * this server is itself on loopback. An origin is echoed only if it is on that
 * list; nothing is reflected blindly.
 *
 * `Access-Control-Allow-Credentials` is never sent, and that is deliberate
 * rather than an omission: authentication here is a bearer token that a caller
 * has to attach on purpose, not a cookie a browser attaches for them. A hostile
 * page in another tab therefore cannot ride along on the owner's session,
 * because there is no session to ride — which is the whole CSRF class gone for
 * a design decision rather than a mitigation.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  API_PREFIX,
  MAX_PAYLOAD_BYTES,
  SERVER_CONTRACT_VERSION,
  apiError,
} from '../src/lib/serverContract.ts';
import { createStore } from './store.mjs';
import { createJobs } from './jobs.mjs';
import { createApi } from './api.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const config = {
  host: process.env.DRAFT_VAULT_HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.DRAFT_VAULT_PORT ?? '8788', 10),
  token: process.env.DRAFT_VAULT_TOKEN?.trim() || null,
  data: process.env.DRAFT_VAULT_DATA ?? join(ROOT, '.draft-vault-data'),
  // Deliberately not the machine's hostname. This is returned by the
  // unauthenticated handshake, and over a public tunnel that told any anonymous
  // caller whose laptop they had found.
  name: process.env.DRAFT_VAULT_NAME?.trim() || 'draft vault',
  origins: (process.env.DRAFT_VAULT_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Hostnames this server answers to beyond loopback. A tunnel names its own
  // here; anything else is refused, which is what closes DNS rebinding.
  hosts: (process.env.DRAFT_VAULT_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
  dist: join(ROOT, 'dist'),
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const onLoopback = LOOPBACK.has(config.host);

if (!onLoopback && !config.token) {
  console.error(
    `\nRefusing to start.\n\n` +
      `  DRAFT_VAULT_HOST is ${config.host}, which is not loopback, and there is no\n` +
      `  DRAFT_VAULT_TOKEN. That combination puts an unauthenticated store of your\n` +
      `  drafts on a network interface.\n\n` +
      `  Set a token, or leave the host at 127.0.0.1 and point a tunnel at it —\n` +
      `  a tunnel connects outward from this machine and reaches loopback fine.\n`
  );
  process.exit(1);
}

mkdirSync(config.data, { recursive: true });

const capabilities = {
  pool: existsSync(join(ROOT, 'scripts/build-player-pool.mjs')),
  // A boolean about the key, computed once, and the only thing anything ever
  // learns about it. The key itself goes from this process into a child of it
  // and is in no route, no log line and no response body.
  research:
    existsSync(join(ROOT, 'scripts/research-players.mjs')) && !!process.env.OPENROUTER_API_KEY,
};

const store = createStore(config.data);
const jobs = createJobs({ repoRoot: ROOT, dataDir: config.data, capabilities });

const startedAt = new Date().toISOString();
const api = createApi({
  store,
  jobs,
  token: config.token,
  health: () => ({
    kind: 'draft-vault-server',
    contract: SERVER_CONTRACT_VERSION,
    name: config.name,
    requiresToken: !!config.token,
    jobs: capabilities,
    startedAt,
  }),
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const isLoopbackOrigin = (origin) => {
  try {
    return LOOPBACK.has(new URL(origin).hostname);
  } catch {
    return false;
  }
};

/**
 * Whether the Host this request names is one we answer to.
 *
 * Without this the server answers to any hostname that resolves to it, which is
 * the whole of a DNS rebinding attack: an attacker domain whose record flips to
 * 127.0.0.1 makes the browser treat the page and this API as the same origin,
 * so no preflight is sent, the origin allowlist is never consulted, and the
 * responses are readable. That turns blind writes into full reads of every
 * saved draft. The standard defence for a loopback service, and the tunnel
 * deployment simply names its own hostname in DRAFT_VAULT_HOSTS.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

const allowedHost = (header) => {
  if (!header) return false;
  const host = String(header)
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
  if (LOOPBACK_HOSTS.has(host)) return true;
  return config.hosts.includes(host);
};

const allowedOrigin = (origin) => {
  if (!origin) return null;
  if (config.origins.includes(origin)) return origin;
  // A page on this machine talking to a server on this machine — `npm run dev`
  // on :8080. Only offered when the server is itself unreachable from anywhere
  // else, so it cannot widen what the tunnel exposes.
  if (onLoopback && isLoopbackOrigin(origin)) return origin;
  return null;
};

const applyCors = (request, response) => {
  const origin = allowedOrigin(request.headers.origin);
  // Told to vary whether or not one was allowed: a cache that kept the answer
  // for one origin and replayed it for another would be handing out an
  // allowance nobody granted.
  response.setHeader('Vary', 'Origin');
  if (!origin) return;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Draft-Vault-Contract'
  );
  response.setHeader('Access-Control-Max-Age', '600');
};

// ---------------------------------------------------------------------------
// static: the app itself, when it has been built
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Tell the page it is being served by a server.
 *
 * The client never probes an address nobody gave it — a speculative fetch that
 * fails is a red line in the console on every load of an app whose normal state
 * is having no server at all. So discovery is opt-in, and this is the opt-in
 * for the case where the app is coming off the server itself: a meta tag saying
 * where the API is. Served from disk, injected in memory; `dist/index.html`
 * on disk is never touched, so the same build stays publishable as a static
 * bundle and as an artifact with no trace of this in it.
 */
const withServerMeta = (html) =>
  html.replace(
    /<\/head>/i,
    `  <meta name="draft-vault-server" content="${API_PREFIX}">\n  </head>`
  );

const serveStatic = (request, response) => {
  if (!existsSync(config.dist)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(
      'No dist/ here yet. Run `npm run build`, or open the dev server and point it at this one.\n'
    );
    return;
  }

  // A stray `%` makes decodeURIComponent throw URIError. This runs before any
  // token check, on every path that is not /api, so an unauthenticated GET of
  // `/%` used to take the whole process down — a tunnel URL and one keystroke
  // ending draft night's backup. Answer 400 rather than throwing.
  let requested;
  try {
    requested = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad path\n');
    return;
  }
  // `normalize` collapses the `..` a request can be spelled with; the prefix
  // check is what makes sure it collapsed to somewhere inside dist/.
  const candidate = join(config.dist, normalize(requested));
  const inside = candidate === config.dist || candidate.startsWith(`${config.dist}/`);
  const isFile = inside && existsSync(candidate) && statSync(candidate).isFile();

  // A single-page app: anything that is not a file is a route, and gets the
  // shell. Same rule as `nginx.conf`'s try_files.
  const path = isFile ? candidate : join(config.dist, 'index.html');
  if (!existsSync(path)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
    return;
  }

  const type = MIME[extname(path)] ?? 'application/octet-stream';
  if (path.endsWith('index.html')) {
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(withServerMeta(readFileSync(path, 'utf8')));
    return;
  }
  response.writeHead(200, { 'Content-Type': type });
  response.end(readFileSync(path));
};

// ---------------------------------------------------------------------------

/** Read a JSON body, refusing anything past the contract's limit as it arrives. */
const readBody = (request) =>
  new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let over = false;
    request.on('data', (chunk) => {
      if (over) return;
      size += chunk.length;
      // Checked per chunk rather than at the end, so a hostile length never
      // gets buffered in the first place. Answered rather than reset, though:
      // destroying the socket here meant 'end' never fired, the promise never
      // settled, and the 413 the contract defines was unreachable — the client
      // saw a transport failure and reported the server as down, which is a
      // different thing from "that draft is too big" and sends you looking in
      // the wrong place at the worst time.
      if (size > MAX_PAYLOAD_BYTES) {
        over = true;
        chunks.length = 0;
        request.pause();
        resolve({ ok: false, tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (over) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) return resolve({ ok: true, value: undefined });
      try {
        resolve({ ok: true, value: JSON.parse(text) });
      } catch {
        resolve({ ok: false, tooLarge: false });
      }
    });
    request.on('error', () => resolve({ ok: false, tooLarge: false }));
  });

const sendJson = (response, status, body) => {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    // Nothing this server says is worth a cache holding on to, and a cached
    // draft list would be a wrong one the moment anybody saved.
    'Cache-Control': 'no-store',
  });
  response.end(text);
};

const server = createServer(async (request, response) => {
  applyCors(request, response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!allowedHost(request.headers.host)) {
    response.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('This server does not answer to that host.\n');
    return;
  }

  const url = new URL(request.url, 'http://x');
  if (!url.pathname.startsWith(API_PREFIX)) {
    serveStatic(request, response);
    return;
  }

  const body = await readBody(request);
  if (!body.ok) {
    sendJson(
      response,
      body.tooLarge ? 413 : 400,
      apiError(
        body.tooLarge ? 'too-large' : 'bad-request',
        body.tooLarge ? 'That body is past the size limit.' : 'That body is not readable as JSON.'
      )
    );
    return;
  }

  try {
    const result = await api({
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: body.value,
      authorization: request.headers.authorization,
      contract: request.headers['x-draft-vault-contract'],
    });
    sendJson(response, result.status, result.body);
  } catch (error) {
    // A handler that threw is a bug here, not something the caller did; it is
    // logged locally and reported as nothing more than a failure, because the
    // stack of a process holding an API key is not something to put on a wire.
    console.error('[draft-vault] unhandled', error);
    sendJson(response, 500, apiError('server-error', 'Something went wrong on the server.'));
  }
});

// A request must never be able to end the process. The static branch above is
// reachable without credentials, so anything that escapes it would be a remote
// kill switch; these are the backstop for the next one nobody thought of.
process.on('uncaughtException', (error) => {
  console.error('[draft-vault] uncaught', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[draft-vault] unhandled rejection', error);
});

server.listen(config.port, config.host, () => {
  console.log(`\nDraft Vault server — ${config.name}\n`);
  console.log(`  listening    http://${config.host}:${config.port}`);
  console.log(`  contract     v${SERVER_CONTRACT_VERSION}`);
  console.log(`  drafts in    ${config.data}`);
  console.log(`  auth         ${config.token ? 'shared token required' : 'none (loopback only)'}`);
  console.log(`  pool job     ${capabilities.pool ? 'yes' : 'no'}`);
  console.log(`  research job ${capabilities.research ? 'yes' : 'no — set OPENROUTER_API_KEY'}`);
  console.log(
    `  serving app  ${existsSync(config.dist) ? 'dist/ (same origin as the API)' : 'no — run npm run build'}`
  );
  if (config.origins.length) console.log(`  cors         ${config.origins.join(' ')}`);
  console.log('\n  The app works with this stopped. Everything here is a copy.\n');
});

const shutdown = () => {
  jobs.stopAll();
  server.close(() => process.exit(0));
  // A job that ignores SIGTERM must not hold the process open forever.
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
