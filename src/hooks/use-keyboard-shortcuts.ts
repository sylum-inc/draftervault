import { useEffect, useCallback, useRef } from 'react';

type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
};

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 *
 * @example
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: 's', ctrl: true, action: () => save(), description: 'Save draft' },
 *     { key: '/', action: () => focusSearch(), description: 'Focus search' },
 *     { key: 'Escape', action: () => closeModal(), description: 'Close modal' },
 *   ]
 * });
 */
export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const metaMatch = shortcut.meta ? event.metaKey : true; // Meta is optional

      // Allow Escape to work even in inputs
      const allowInInput = shortcut.key.toLowerCase() === 'escape';

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        if (!isInput || allowInInput) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: shortcutsRef.current,
  };
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) {
    // Use Cmd on Mac, Ctrl on Windows/Linux
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.alt) {
    parts.push('Alt');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }

  // Format special keys
  let key = shortcut.key;
  switch (key.toLowerCase()) {
    case 'escape':
      key = 'Esc';
      break;
    case 'enter':
      key = '↵';
      break;
    case 'arrowup':
      key = '↑';
      break;
    case 'arrowdown':
      key = '↓';
      break;
    case 'arrowleft':
      key = '←';
      break;
    case 'arrowright':
      key = '→';
      break;
    default:
      key = key.toUpperCase();
  }

  parts.push(key);
  return parts.join(' + ');
}

/**
 * Predefined common shortcuts
 */
export const commonShortcuts = {
  save: { key: 's', ctrl: true },
  undo: { key: 'z', ctrl: true },
  redo: { key: 'z', ctrl: true, shift: true },
  search: { key: '/' },
  escape: { key: 'Escape' },
  enter: { key: 'Enter' },
  delete: { key: 'Backspace' },
  selectAll: { key: 'a', ctrl: true },
  copy: { key: 'c', ctrl: true },
  paste: { key: 'v', ctrl: true },
  cut: { key: 'x', ctrl: true },
} as const;

export default useKeyboardShortcuts;
