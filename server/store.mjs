/**
 * Saved drafts on disk.
 *
 * **JSON files in a directory, and that is not a placeholder for a database.**
 * One person keeps a few dozen drafts of about fifty kilobytes each; the whole
 * store fits in a rounding error of a phone photo. What it has to be good at is
 * exactly one thing — being there at eleven at night when the laptop running
 * the auction has stopped being there — and a directory of plain files is the
 * best possible shape for that. It can be read with `cat`, copied with `cp`,
 * carried on a USB stick, opened in a text editor by somebody who has never
 * seen this repo, and recovered from a half-finished write by deleting one
 * file. A SQLite database would add a dependency and turn the recovery story
 * into "find a sqlite3 binary", which is the wrong trade for a filing cabinet.
 *
 * Layout, one directory per draft:
 *
 *   drafts/<id>/meta.json     name, timestamps, and the version list
 *   drafts/<id>/v0001.json    one version: its summary, and the payload
 *
 * **Versions are separate immutable files, and that is the point.** The owner
 * asked for history because losing an afternoon is expensive and a save is
 * cheap, so a save must never be a rewrite of anything that already exists: it
 * is a new file, and the only edit is appending a line to the index beside it.
 * Losing a version requires deleting a file on purpose. A full hybrid draft is
 * about 380 picks, so about 380 versions of 50 kB — nineteen megabytes to
 * guarantee that no state of the draft is unreachable, which is the correct
 * amount of disk to spend on draft night.
 *
 * Nothing here parses a payload. The server does not know what a draft is; see
 * the header of `src/lib/serverContract.ts` for why that matters.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { SERVER_CONTRACT_VERSION, isDraftId } from '../src/lib/serverContract.ts';

/**
 * Write, then move into place.
 *
 * A crash halfway through `writeFileSync` leaves a truncated file, and a
 * truncated meta.json is a draft that has silently lost its history. Renaming
 * over the top is atomic within a filesystem, so a reader sees either the old
 * file or the new one and never half of either.
 */
const writeAtomic = (path, text) => {
  const temp = `${path}.tmp-${randomBytes(4).toString('hex')}`;
  writeFileSync(temp, text);
  renameSync(temp, path);
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

const versionFile = (dir, version) => join(dir, `v${String(version).padStart(4, '0')}.json`);

/** Ids are hex, which is the alphabet `isDraftId` accepts and no path can hide in. */
const newId = () => randomBytes(8).toString('hex');

export const createStore = (root) => {
  const draftsDir = join(root, 'drafts');
  mkdirSync(draftsDir, { recursive: true });

  const dirFor = (id) => (isDraftId(id) ? join(draftsDir, id) : null);

  const readMeta = (id) => {
    const dir = dirFor(id);
    if (!dir) return null;
    const meta = readJson(join(dir, 'meta.json'));
    // A directory without a readable index is not half a draft, it is a draft
    // nothing can be said about — so it is reported as absent rather than as an
    // empty one, which would invite a save that overwrote its index.
    if (!meta || meta.id !== id || !Array.isArray(meta.versions)) return null;
    return meta;
  };

  const summarise = (meta) => ({
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    versions: meta.versions.length,
    latest: meta.versions.length ? meta.versions[meta.versions.length - 1] : null,
  });

  const writeMeta = (meta) => {
    writeAtomic(join(draftsDir, meta.id, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  };

  return {
    /** Every draft, newest activity first — which is the order somebody wants them. */
    list() {
      const ids = existsSync(draftsDir) ? readdirSync(draftsDir) : [];
      return ids
        .map((id) => readMeta(id))
        .filter((meta) => meta !== null)
        .map(summarise)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    /** One draft with its whole history, newest version first. */
    get(id) {
      const meta = readMeta(id);
      if (!meta) return null;
      return { ...summarise(meta), history: [...meta.versions].reverse() };
    },

    create({ name, payload, note }) {
      const id = newId();
      const dir = join(draftsDir, id);
      mkdirSync(dir, { recursive: true });
      const now = new Date().toISOString();
      const meta = { id, name, createdAt: now, updatedAt: now, versions: [] };
      writeMeta(meta);
      return this.addVersion(id, { payload, note });
    },

    /**
     * Add a version. The name changes only if a new one was sent.
     *
     * The version file is written before the index that points at it, so an
     * interrupted save leaves an orphan file rather than an index entry with
     * nothing behind it. An orphan costs 50 kB; a dangling entry is a draft
     * that says it has a version it cannot produce.
     */
    addVersion(id, { name, payload, note }) {
      const meta = readMeta(id);
      if (!meta) return null;
      const version = meta.versions.length + 1;
      const summary = {
        version,
        savedAt: new Date().toISOString(),
        bytes: Buffer.byteLength(payload, 'utf8'),
        note: note ?? 'saved',
        contract: SERVER_CONTRACT_VERSION,
      };
      writeAtomic(
        versionFile(join(draftsDir, id), version),
        `${JSON.stringify({ ...summary, id, payload }, null, 2)}\n`
      );
      meta.versions.push(summary);
      meta.updatedAt = summary.savedAt;
      if (name) meta.name = name;
      writeMeta(meta);
      return { ...summarise(meta), history: [...meta.versions].reverse() };
    },

    rename(id, name) {
      const meta = readMeta(id);
      if (!meta) return null;
      meta.name = name;
      meta.updatedAt = new Date().toISOString();
      writeMeta(meta);
      return { ...summarise(meta), history: [...meta.versions].reverse() };
    },

    /** One version, with the bytes the client will hand to `importDraft`. */
    version(id, version) {
      const dir = dirFor(id);
      if (!dir || !Number.isInteger(version) || version < 1) return null;
      return readJson(versionFile(dir, version));
    },

    remove(id) {
      const dir = dirFor(id);
      if (!dir || !existsSync(dir)) return false;
      rmSync(dir, { recursive: true, force: true });
      return true;
    },
  };
};
