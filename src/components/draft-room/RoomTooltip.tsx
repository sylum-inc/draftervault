import { useEffect, useRef } from 'react';

/**
 * One tooltip for the whole room, in the room's own type.
 *
 * Every `title` attribute in the app was a browser tooltip: half a second late,
 * in the operating system's face, and gone the moment the cursor twitched. On
 * a screen where the caption *is* the reading — a tile that says why the
 * walk-away is what it is, a chip that says why a team cannot bid — that is
 * the wrong instrument. This listens once, on the room, for the cursor
 * arriving on anything with a title; it lifts the text off the element into
 * `data-tip` so the browser has nothing left to show, draws it beside the
 * cursor in a panel styled like everything else, and puts the title back when
 * the cursor leaves so the attribute is still there for whatever reads it.
 *
 * The card's own instruments are not routed here: they carry `data-tip` and
 * read into the strip at the card's foot, which sits still while the cursor
 * moves over the thing it describes. A tip that followed the cursor over a
 * sixteen-column shelf would cover the shelf.
 *
 * No React state on the hot path — the panel is written through a ref on
 * `mousemove`, which fires far too often to re-render anything for.
 */
export const RoomTooltip = () => {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    let current: Element | null = null;
    let frame = 0;
    let lastX = 0;
    let lastY = 0;

    const place = () => {
      frame = 0;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const margin = 14;
      let x = lastX + margin;
      let y = lastY + margin;
      if (x + width > window.innerWidth - 8) x = lastX - width - margin;
      if (y + height > window.innerHeight - 8) y = lastY - height - margin;
      node.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
    };

    const show = (element: Element, text: string) => {
      current = element;
      element.setAttribute('data-tip-held', text);
      element.removeAttribute('title');
      node.textContent = text;
      node.hidden = false;
      place();
    };

    const hide = () => {
      if (current) {
        const held = current.getAttribute('data-tip-held');
        if (held != null) {
          current.setAttribute('title', held);
          current.removeAttribute('data-tip-held');
        }
      }
      current = null;
      node.hidden = true;
    };

    const over = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      // Inside a card, instruments read into the card's own strip instead.
      if (target.closest('[data-tip]') && target.closest('.dr-card')) {
        if (current) hide();
        return;
      }
      const titled = target.closest('[title], [data-tip-held]') as Element | null;
      if (!titled || !titled.closest('.draft-room')) {
        if (current) hide();
        return;
      }
      if (titled === current) return;
      const text = titled.getAttribute('title') ?? titled.getAttribute('data-tip-held') ?? '';
      if (!text.trim()) {
        if (current) hide();
        return;
      }
      if (current) hide();
      show(titled, text);
    };

    const move = (event: MouseEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!node.hidden && !frame) frame = window.requestAnimationFrame(place);
    };

    const leave = (event: MouseEvent) => {
      if (current && event.target === current) hide();
    };

    document.addEventListener('mouseover', over, true);
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseout', leave, true);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('mouseover', over, true);
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseout', leave, true);
      document.removeEventListener('mousedown', hide, true);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
      if (frame) window.cancelAnimationFrame(frame);
      hide();
    };
  }, []);

  return <div className="dr-tip" role="tooltip" ref={panel} hidden />;
};
