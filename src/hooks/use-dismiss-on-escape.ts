import { useEffect, useRef } from 'react';

/**
 * Escape closes the dialog on top, and only that one.
 *
 * Eleven components had written this effect out by hand and two had not:
 * `DraftBoard` — the room, the 12x16 grid somebody opens mid-auction to check a
 * price — and `CompareTray`. Both are `aria-modal` overlays that cover the
 * screen and intercept every click, so the only way out of either was to find
 * the Close button. An exit you have to hunt for is an exit nobody takes while
 * an auction is running.
 *
 * A hook rather than two more copies, because eleven copies of a rule is how
 * the twelfth gets missed, and because the copies had already diverged: only
 * `PickEditor` stopped the event, and only because it opens *inside*
 * `DraftBoard`. That fix does not survive contact with a `DraftBoard` that also
 * listens — `stopPropagation` does not stop a second listener on the same node,
 * and both are on `document` — so one keystroke would have closed the editor
 * and the board behind it, losing the place somebody was correcting.
 *
 * Hence the stack. Every open dialog registers, and a keystroke is answered
 * only by whichever registered last, which is the one drawn on top. Nesting
 * then works by construction rather than by each dialog knowing what might be
 * above it.
 *
 * The order is deliberately *registration* order and not React's tree order:
 * the two are the same for a dialog opened by a dialog, which is the only case
 * this app has, and tree order would need a DOM read at keystroke time.
 */
const stack: object[] = [];

export const useDismissOnEscape = (onClose: () => void, enabled = true): void => {
  // The callback is read through a ref so the effect depends on `enabled`
  // alone. Call sites pass an inline arrow, so a dependency on the function
  // would re-run this on every parent render — popping and re-pushing, which
  // would float an *outer* dialog to the top of the stack every time the room
  // behind it re-rendered, which it does on every pick.
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const token = {};
    stack.push(token);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (stack[stack.length - 1] !== token) return;
      event.stopPropagation();
      latest.current();
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = stack.lastIndexOf(token);
      if (at >= 0) stack.splice(at, 1);
    };
  }, [enabled]);
};
