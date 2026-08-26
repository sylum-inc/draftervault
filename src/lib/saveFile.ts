/**
 * Handing the viewer a file, wherever the app happens to be running.
 *
 * In a browser this is an anchor with a `download` attribute. Inside the
 * published Artifact it is not: that sandbox blocks any download a page starts
 * itself, including `blob:` and `data:` links, so Export CSV did nothing there
 * and gave no sign of it — the one rough edge the working notes have carried
 * since the artifact shipped.
 *
 * The viewer grants a page the `downloads` capability instead, which puts the
 * save behind a confirmation the person actually sees. This tries that first
 * and falls back to the anchor, so one call site serves both.
 */

/** Only the part of the runtime this module uses. */
interface DownloadsCapability {
  save: (request: { filename: string; data: string | Blob }) => Promise<{ status: 'saved' }>;
}

interface ClaudeRuntime {
  use: (name: string) => Promise<unknown>;
}

export type SaveOutcome =
  /** Written, or handed to the browser's download machinery. */
  | { status: 'saved'; filename: string }
  /** The viewer was asked and said no. Not an error; say nothing loud. */
  | { status: 'declined' }
  /** Nothing could take the file. The caller should offer Copy instead. */
  | { status: 'failed'; reason: string };

const runtime = (): ClaudeRuntime | null => {
  const claude = (globalThis as { claude?: ClaudeRuntime }).claude;
  return claude && typeof claude.use === 'function' ? claude : null;
};

/** Swap a filename's extension, keeping the rest of the name. */
const withExtension = (filename: string, extension: string): string =>
  `${filename.replace(/\.[^.]*$/, '')}.${extension}`;

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : 'unknown';

/**
 * Offer `text` to the viewer as a file.
 *
 * `fallbackExtension` matters: the capability's base format allowlist does not
 * include every type, and `csv` is one it may refuse. Rather than fail, the
 * same bytes go out as the plain-text extension, which is always accepted — a
 * spreadsheet opens it either way.
 */
export const saveTextFile = async (
  filename: string,
  text: string,
  mimeType = 'text/csv;charset=utf-8',
  fallbackExtension = 'txt'
): Promise<SaveOutcome> => {
  const claude = runtime();

  if (claude) {
    let downloads: DownloadsCapability | null = null;
    try {
      downloads = (await claude.use('downloads')) as DownloadsCapability | null;
    } catch {
      downloads = null;
    }

    if (downloads) {
      for (const name of [filename, withExtension(filename, fallbackExtension)]) {
        try {
          await downloads.save({ filename: name, data: text });
          return { status: 'saved', filename: name };
        } catch (error) {
          const code = errorCode(error);
          // The viewer said no, or is being asked too often: retrying under
          // another name would just ask them again.
          if (code === 'declined' || code === 'rate_limited') return { status: 'declined' };
          // Only an extension the host will not take is worth a second attempt.
          if (code !== 'extension_not_enabled' && code !== 'rejected_extension') {
            return { status: 'failed', reason: code };
          }
        }
      }
      return { status: 'failed', reason: 'no acceptable file type' };
    }
  }

  // An ordinary browser. Nothing here works inside the artifact viewer, which
  // is exactly why the branch above exists.
  try {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { status: 'saved', filename };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'unknown' };
  }
};
