/**
 * Running the batch scripts from a request instead of a terminal.
 *
 * `scripts/build-player-pool.mjs` and `scripts/research-players.mjs` are not
 * reimplemented, wrapped or reasoned about here. They are spawned with the same
 * flags a person would type, their output is captured line by line, and their
 * exit code is reported. That is the whole of it, and it is deliberate: the
 * projection model and the citation contract are hard-won and live in those
 * files, and a second copy of either — even a partial one, even just the
 * argument handling — is exactly the drift `valuation.ts` and
 * `researchContract.ts` exist to prevent.
 *
 * **Progress is polled, not streamed, and that was a decision rather than a
 * shortcut.** Server-Sent Events are within reach of the standard library and
 * would have been about the same amount of code here. Three things decided it
 * the other way. An `EventSource` cannot carry an `Authorization` header, so
 * the token would have had to travel in the query string, where it lands in
 * every proxy log between the laptop and the tunnel — a real downgrade for the
 * one secret this design has. A tunnel is also the worst place for a long-held
 * connection: it buffers, it idles out, and reconnect-and-resume logic is more
 * code than polling ever was. And these jobs run for twenty minutes, printing a
 * line every second or two, so a stream buys nothing a poll every second and a
 * half does not already give — while the poll survives closing the laptop lid,
 * reloading the page, and losing the tunnel entirely, because the job's state
 * lives in this process and not in a socket.
 *
 * Jobs run one at a time. Both of them saturate the network or the CPU and both
 * write files; two at once would be slower than one after the other and would
 * race over the same staging tree.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { JOB_LOG_LINES, JOB_SCRIPTS, JOB_SEEDS, jobArgs } from '../src/lib/serverContract.ts';

export const createJobs = ({ repoRoot, dataDir, capabilities }) => {
  /** id -> { record, lines: string[], total: number, child } */
  /**
 * How many finished jobs to remember.
 *
 * The Map held every job ever started, each with up to 500 captured lines, and
 * every start also made a staging directory nothing removed. One at a time
 * bounds concurrency but not the rate — cancel returns immediately, so a
 * start/cancel loop grows both without limit. Behind the token, so not a
 * drive-by, but a laptop on draft night is the wrong place to leak memory.
 */
const KEEP_JOBS = 20;

const jobs = new Map();

  const publicRecord = (entry) => ({ ...entry.record, lines: entry.total });

  /** Split whatever arrived on the pipe into whole lines, keeping the remainder. */
  const collector = (entry) => {
    let pending = '';
    return (chunk) => {
      pending += chunk;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const line of parts) {
        entry.total += 1;
        entry.lines.push(line);
        // A ring, so a twenty-minute run cannot grow without bound. `total`
        // keeps counting, which is what lets a poll say where it left off even
        // after the lines it wanted have rolled off the end.
        if (entry.lines.length > JOB_LOG_LINES) entry.lines.shift();
      }
    };
  };

  return {
    list: () => [...jobs.values()].map(publicRecord),

    /**
     * Start one, or say why not.
     *
     * `options` has already been through `validateStartJob`; `jobArgs` turns it
     * into an argv and is the only thing that does. Nothing a caller sent
     * reaches the command line as a string.
     */
    start(kind, options) {
      if (!capabilities[kind]) {
        return {
          ok: false,
          code: 'unavailable',
          message:
            kind === 'research'
              ? 'This server has no OPENROUTER_API_KEY, so it cannot research anybody.'
              : `This server cannot run the ${kind} job.`,
        };
      }
      const running = [...jobs.values()].find((entry) => entry.record.state === 'running');
      if (running) {
        return {
          ok: false,
          code: 'busy',
          message: `A ${running.record.kind} job is already running. These saturate the machine, so they go one at a time.`,
        };
      }

      const id = randomBytes(6).toString('hex');
      const outDir = join(dataDir, 'artifacts', id);
      mkdirSync(outDir, { recursive: true });

      // The research script merges into whatever is at `--out` and skips anyone
      // asked about recently. Pointed at an empty directory it would lose both
      // and pay for all 628 players again, so it starts from a copy of what we
      // already have.
      const seed = JOB_SEEDS[kind];
      if (seed && existsSync(join(repoRoot, seed))) {
        copyFileSync(join(repoRoot, seed), join(outDir, seed.split('/').pop()));
      }

      const args = [join(repoRoot, JOB_SCRIPTS[kind]), ...jobArgs(kind, options, outDir)];
      const entry = {
        record: {
          id,
          kind,
          state: 'running',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          exitCode: null,
          outDir,
        },
        lines: [],
        total: 0,
        child: null,
      };
      jobs.set(id, entry);

      // Forget the oldest finished jobs, and take their staging directories
      // with them — a cancelled or failed job's output is disposable by
      // definition, and a running one is never a candidate.
      const finished = [...jobs.values()].filter((job) => job.record.state !== 'running');
      for (const stale of finished.slice(0, Math.max(0, finished.length - KEEP_JOBS))) {
        jobs.delete(stale.record.id);
        try {
          rmSync(stale.record.outDir, { recursive: true, force: true });
        } catch {
          /* already gone, or in use — the next start will try again */
        }
      }

      const child = spawn(process.execPath, args, {
        cwd: repoRoot,
        // The environment is inherited whole, which is how OPENROUTER_API_KEY
        // reaches the research script. It goes from this process straight into
        // a child of it and is never written down, never logged and never in
        // any response — there is no route in the contract that could return it.
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      entry.child = child;

      const absorb = collector(entry);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', absorb);
      child.stderr.on('data', absorb);

      child.on('error', (error) => {
        absorb(`!! could not start: ${error.message}\n`);
        entry.record.state = 'failed';
        entry.record.finishedAt = new Date().toISOString();
      });

      child.on('close', (code, signal) => {
        entry.record.finishedAt = new Date().toISOString();
        entry.record.exitCode = code;
        // A job somebody stopped is not a job that failed, and the panel says
        // so — a red "failed" beside a button the owner just pressed reads as
        // something having gone wrong.
        if (entry.record.state === 'cancelled') return;
        if (signal) {
          entry.record.state = 'cancelled';
        } else {
          entry.record.state = code === 0 ? 'done' : 'failed';
        }
      });

      return { ok: true, job: publicRecord(entry) };
    },

    /** A job's state, plus whatever log lines the caller has not seen. */
    read(id, since) {
      const entry = jobs.get(id);
      if (!entry) return null;
      const oldest = entry.total - entry.lines.length;
      const from = Math.max(Number.isInteger(since) && since >= 0 ? since : 0, oldest);
      return {
        job: publicRecord(entry),
        from,
        lines: entry.lines.slice(from - oldest),
      };
    },

    cancel(id) {
      const entry = jobs.get(id);
      if (!entry || entry.record.state !== 'running') return false;
      entry.record.state = 'cancelled';
      entry.child?.kill('SIGTERM');
      return true;
    },

    /** Stop everything, so shutting the server down does not orphan a download. */
    stopAll() {
      for (const entry of jobs.values()) {
        if (entry.record.state === 'running') {
          entry.record.state = 'cancelled';
          entry.child?.kill('SIGTERM');
        }
      }
    },
  };
};
