import { describe, expect, it } from 'vitest';
import { packColumns } from '@/components/draft-room/usePackedColumns';

/**
 * The packing that replaced CSS multi-column, checked as arithmetic. jsdom
 * lays nothing out, so the sizes are stated: a 900px container and children
 * of known heights, and what is asserted is where each one is dealt.
 */
const box = (width: number, heights: number[], wide: number[] = []) => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width });
  container.style.columnGap = '12px';
  const children = heights.map((height, index) => {
    const child = document.createElement('section');
    Object.defineProperty(child, 'offsetHeight', { value: height });
    if (wide.includes(index)) child.className = 'is-wide';
    container.appendChild(child);
    return child;
  });
  document.body.appendChild(container);
  return { container, children };
};

describe('packColumns', () => {
  it('deals each section to the shortest column so far', () => {
    const { container, children } = box(900, [400, 100, 200, 100, 300]);
    const cols = packColumns(container, { minWidth: 340, unit: 4 });
    // (900 + 12) / (340 + 12) = 2.59 → two columns.
    expect(cols).toBe(2);
    expect(container.getAttribute('data-packed')).toBe('2');
    expect(children.map((c) => c.style.gridColumn)).toEqual(['1', '2', '2', '2', '1']);
    // Rows are 4px: 400px is 100 rows, so the fifth section starts at row 101
    // in column one, under the first; column two stacks 100 + 200 + 100.
    expect(children[0].style.gridRow).toBe('1 / span 100');
    expect(children[1].style.gridRow).toBe('1 / span 25');
    expect(children[2].style.gridRow).toBe('26 / span 50');
    expect(children[3].style.gridRow).toBe('76 / span 25');
    expect(children[4].style.gridRow).toBe('101 / span 75');
  });

  it('spans a wide section across every column and starts a fresh band under it', () => {
    const { container, children } = box(1200, [200, 100, 60, 100], [2]);
    expect(packColumns(container, { minWidth: 340, unit: 4 })).toBe(3);
    expect(children[2].style.gridColumn).toBe('1 / -1');
    // The band starts beneath the tallest column (200px = 50 rows)…
    expect(children[2].style.gridRow).toBe('51 / span 15');
    // …and the next section goes into the first column of the new band.
    expect(children[3].style.gridColumn).toBe('1');
    expect(children[3].style.gridRow).toBe('66 / span 25');
  });

  it('never has fewer than one column', () => {
    const { container, children } = box(200, [50, 50]);
    expect(packColumns(container, { minWidth: 340 })).toBe(1);
    expect(children.map((c) => c.style.gridColumn)).toEqual(['1', '1']);
  });

  it('leaves a container that is not rendered exactly as it was', () => {
    const { container, children } = box(0, [100, 100]);
    children[0].style.gridColumn = '2';
    children[0].style.gridRow = '9 / span 25';
    expect(packColumns(container, { minWidth: 340, unit: 4 })).toBe(0);
    expect(container.hasAttribute('data-packed')).toBe(false);
    expect(children[0].style.gridColumn).toBe('2');
    expect(children[0].style.gridRow).toBe('9 / span 25');
    expect(children[1].style.gridColumn).toBe('');
  });

  it('leaves a hidden child out of the packing', () => {
    const { container, children } = box(900, [100, 100, 100]);
    children[1].style.display = 'none';
    packColumns(container, { minWidth: 340, unit: 4 });
    expect(children[1].style.gridRow).toBe('');
    expect(children.map((c) => c.style.gridColumn)).toEqual(['1', '', '2']);
  });
});
