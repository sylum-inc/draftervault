import { useLayoutEffect } from 'react';

/**
 * Columns that pack, without CSS multi-column.
 *
 * The dossier's tabs and the Tonight tab were `columns: 420px` / `columns:
 * 340px` with `break-inside: avoid` — columns fill down and then across, so a
 * short section beside a tall one leaves no hole, which is what a grid of rows
 * could not do. Chromium renders that correctly. Safari does not: WebKit's
 * fragmentation goes stale when the content inside a column changes after
 * layout, and typing a bid changes it sixty times a night. The screenshot that
 * found it had the plan's three rows painted inside the "Can beat" box, the
 * price chain inside "The plan", and the rival rows over the advisor — every
 * section's border in the right place and its contents one section away.
 * On the Overview tab the same engine overflowed the columns sideways into a
 * horizontal scrollbar.
 *
 * So the packing is done here instead, in a way no browser fragments. The
 * container is an ordinary grid of N equal columns and rows of a few pixels;
 * each child is measured and handed a column — the shortest so far — and a
 * run of rows tall enough to hold it. Nothing moves in the DOM: a child keeps
 * its parent and its position among its siblings, so React never remounts a
 * chart or loses a slider's state, and the stylesheet's `.dr-tabpanel > …`
 * rules keep matching. Only two inline properties are written per child.
 *
 * Wide children — the headline tiles, a verdict line, a notice — span every
 * column and start a fresh band beneath everything placed so far, which is
 * what `column-span: all` did.
 *
 * Measured, not guessed: heights are read from the elements, on mount, on
 * every resize of the container or of any child, and whenever a child comes or
 * goes. `align-self: start` in the stylesheet is what keeps the reading
 * honest — stretched to its grid area, a child would measure as tall as the
 * rows it was last given and the layout would feed on itself.
 */
export interface PackOptions {
  /** The narrowest a column may be; the count of columns follows from the width. */
  minWidth: number;
  /** The row unit in pixels. Positions are quantised to it. */
  unit?: number;
  /** Children matching this span every column. */
  wide?: string;
}

const px = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export const packColumns = (container: HTMLElement, options: PackOptions) => {
  const unit = options.unit ?? 4;
  const wide = options.wide ?? '.is-wide';
  /* Not rendered — the band is display: none under 1180px while the stage
     still mounts it. Every child would measure zero and be dealt one row in
     column one, and the reveal would paint that stack for a frame before the
     observers caught up. Leave whatever was placed last in place instead. */
  if (container.clientWidth === 0) return 0;
  const style = getComputedStyle(container);
  const gap = px(style.columnGap) || 12;
  const inner = container.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
  const cols = Math.max(1, Math.floor((inner + gap) / (options.minWidth + gap)));

  container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  container.style.gridAutoRows = `${unit}px`;
  container.setAttribute('data-packed', String(cols));

  const tops = new Array<number>(cols).fill(0);
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const cs = getComputedStyle(child);
    if (cs.display === 'none') {
      child.style.gridColumn = '';
      child.style.gridRow = '';
      continue;
    }
    const height = child.offsetHeight + px(cs.marginTop) + px(cs.marginBottom);
    const rows = Math.max(1, Math.ceil(height / unit));
    if (child.matches(wide)) {
      const start = Math.max(...tops);
      child.style.gridColumn = '1 / -1';
      child.style.gridRow = `${start + 1} / span ${rows}`;
      tops.fill(start + rows);
    } else {
      let column = 0;
      for (let index = 1; index < cols; index += 1) if (tops[index] < tops[column]) column = index;
      child.style.gridColumn = `${column + 1}`;
      child.style.gridRow = `${tops[column] + 1} / span ${rows}`;
      tops[column] += rows;
    }
  }
  return cols;
};

/**
 * Keeps one container packed. `find` is called inside the effect so the
 * container can be something rendered by a child, looked up from a root ref;
 * `deps` says when to look again (a tab change swaps the panel out).
 */
export const usePackedColumns = (
  find: () => HTMLElement | null,
  options: PackOptions,
  deps: ReadonlyArray<unknown>
) => {
  useLayoutEffect(() => {
    const container = find();
    if (!container) return;
    let frame = 0;
    const run = () => {
      frame = 0;
      packColumns(container, options);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    run();

    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    const watchChildren = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(container);
      for (const child of Array.from(container.children)) resize.observe(child);
    };
    watchChildren();
    const mutate =
      typeof MutationObserver === 'function'
        ? new MutationObserver(() => {
            watchChildren();
            schedule();
          })
        : null;
    mutate?.observe(container, { childList: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize?.disconnect();
      mutate?.disconnect();
      container.removeAttribute('data-packed');
      container.style.gridTemplateColumns = '';
      container.style.gridAutoRows = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the caller's own change signal
  }, deps);
};
