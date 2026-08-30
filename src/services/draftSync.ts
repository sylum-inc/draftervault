/**
 * Keeping two windows of the same draft in step.
 *
 * One person runs the auction on a laptop while the room watches a board on a
 * television. That is two windows of the same app on the same machine, and
 * until now the second one showed whatever it had loaded and never moved
 * again.
 *
 * This is deliberately the smallest thing that works. It carries no state: it
 * says only "the draft changed", and the receiving window rebuilds from the
 * same localStorage the sender just wrote. That keeps the rule the engine is
 * built on — the pick log is the only shared fact, and everything else is
 * derived — rather than inventing a second copy of the draft that travels over
 * a channel and could disagree with the first.
 *
 * It is same-browser only, which is what `BroadcastChannel` is. A draft shared
 * between twelve people in twelve houses needs a server, and this repo does not
 * have one.
 */

const CHANNEL = 'draft-vault:draft';

/** What actually crosses the channel. Not the draft — just word that it moved. */
interface Ping {
  /**
   * Which window sent it.
   *
   * A `BroadcastChannel` never delivers to the window that posted, but a window
   * can hold more than one subscriber, and a reload can leave a stale one
   * briefly alive. Ignoring our own id keeps a change from echoing back and
   * rebuilding the state that produced it.
   */
  from: string;
  at: number;
}

export interface DraftSync {
  /** Tell every other window that the stored draft moved. */
  publish: () => void;
  /** Stop listening and release the channel. */
  close: () => void;
  /** False when the browser has no BroadcastChannel; callers carry on regardless. */
  readonly available: boolean;
}

const newId = (): string =>
  // Only needs to be unique among the windows one person has open.
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Open the channel.
 *
 * `onRemoteChange` fires when another window changed the draft. It is not told
 * what changed, because the receiver reads that from storage — a message that
 * carried the change could arrive out of order, and then two screens would
 * disagree about a draft that has exactly one true version on disk.
 */
export const openDraftSync = (onRemoteChange: () => void): DraftSync => {
  const id = newId();

  let channel: BroadcastChannel | null = null;
  try {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    // Some privacy modes throw on construction rather than omitting the API.
    channel = null;
  }

  if (channel) {
    channel.onmessage = (event: MessageEvent<Ping>) => {
      if (!event.data || event.data.from === id) return;
      onRemoteChange();
    };
  }

  return {
    available: channel !== null,
    publish: () => {
      try {
        channel?.postMessage({ from: id, at: Date.now() } satisfies Ping);
      } catch {
        // A closed or broken channel must never take a pick down with it.
      }
    },
    close: () => {
      try {
        if (channel) channel.onmessage = null;
        channel?.close();
      } catch {
        /* already gone */
      }
      channel = null;
    },
  };
};
