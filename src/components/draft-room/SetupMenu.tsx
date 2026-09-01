import { useEffect, useId, useRef, useState } from 'react';
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape';

export interface SetupItem {
  label: string;
  title?: string;
  onSelect: () => void;
  /** Something is in force behind this item — a sheet loaded, a server found. */
  active?: boolean;
}

interface SetupMenuProps {
  items: SetupItem[];
  label?: string;
}

/**
 * The things that are set up once, behind one button.
 *
 * The top bar carried eleven controls of identical weight and wrapped to a
 * second row at any laptop width — at 1440 the header was 95px, at 1100 it was
 * 133, and the row it wrapped onto held "Reset" alone. Six of those controls
 * are pressed once a night or never: the rankings, the sheet, the league, the
 * snake order, the file panel and the server. Putting them behind a menu is
 * not hiding them; it is saying, in the layout, that they are not what the
 * auction touches. What the auction touches stays on the bar.
 *
 * Native `<button>` and a list, no library: dismissed by Escape through the
 * shared stack so it nests correctly with the modals it opens, and by a click
 * anywhere outside it.
 */
export const SetupMenu = ({ items, label = 'Setup' }: SetupMenuProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useDismissOnEscape(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const live = items.filter((item) => item.active).length;

  return (
    <div className="dr-menu" ref={root}>
      <button
        type="button"
        className="dr-button dr-button-ghost dr-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        title="Rankings, the sheet, the league, the snake order, the file and the server"
      >
        {label}
        {live > 0 && <span className="dr-menu-count">{live}</span>}
        <span className="dr-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="dr-menu-list" role="menu" id={id}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="dr-menu-item"
                data-active={item.active ? '' : undefined}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
                {item.active && <span className="dr-menu-dot" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
