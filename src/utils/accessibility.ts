/**
 * Accessibility utilities for Draft Vault
 * Implements WCAG 2.1 AA compliance helpers
 */

// Focus management
export const focusableElements = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  return Array.from(container.querySelectorAll(focusableElements));
};

export const trapFocus = (container: HTMLElement) => {
  const focusable = getFocusableElements(container);
  const firstFocusable = focusable[0];
  const lastFocusable = focusable[focusable.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

// Announcements for screen readers
let announceElement: HTMLDivElement | null = null;

export const createAnnouncer = () => {
  if (announceElement) return;

  announceElement = document.createElement('div');
  announceElement.setAttribute('role', 'status');
  announceElement.setAttribute('aria-live', 'polite');
  announceElement.setAttribute('aria-atomic', 'true');
  announceElement.className = 'sr-only';
  announceElement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  document.body.appendChild(announceElement);
};

export const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  if (!announceElement) {
    createAnnouncer();
  }

  if (announceElement) {
    announceElement.setAttribute('aria-live', priority);
    announceElement.textContent = '';

    // Brief delay to ensure announcement is made
    requestAnimationFrame(() => {
      if (announceElement) {
        announceElement.textContent = message;
      }
    });
  }
};

// Draft-specific announcements
export const announceDraftPick = (playerName: string, teamName: string, cost: number) => {
  announce(`${playerName} drafted by ${teamName} for ${cost} dollars`, 'assertive');
};

export const announceBid = (teamName: string, amount: number) => {
  announce(`${teamName} bids ${amount} dollars`, 'polite');
};

export const announceTimer = (seconds: number) => {
  if (seconds <= 10 && seconds > 0) {
    announce(`${seconds} seconds remaining`, 'assertive');
  } else if (seconds === 0) {
    announce('Time expired', 'assertive');
  }
};

export const announcePlayerOnBlock = (playerName: string, position: string) => {
  announce(`Now drafting: ${playerName}, ${position}`, 'assertive');
};

// Keyboard navigation helpers
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export const matchesShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
  const altMatch = !!shortcut.alt === event.altKey;
  const shiftMatch = !!shortcut.shift === event.shiftKey;

  return keyMatch && ctrlMatch && altMatch && shiftMatch;
};

export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  parts.push(shortcut.key.toUpperCase());
  return parts.join(' + ');
};

// Color contrast helpers
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    const rgb = hexToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

export const meetsWCAGAA = (foreground: string, background: string, isLargeText = false): boolean => {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
};

// Reduced motion detection
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// High contrast mode detection
export const prefersHighContrast = (): boolean => {
  return window.matchMedia('(prefers-contrast: more)').matches;
};

// Skip link component helper
export const createSkipLink = (targetId: string, text: string = 'Skip to main content') => {
  const link = document.createElement('a');
  link.href = `#${targetId}`;
  link.className = 'skip-link';
  link.textContent = text;
  link.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--primary);
    color: white;
    padding: 8px 16px;
    z-index: 100;
    transition: top 0.3s;
  `;

  link.addEventListener('focus', () => {
    link.style.top = '0';
  });

  link.addEventListener('blur', () => {
    link.style.top = '-40px';
  });

  return link;
};

// ARIA label generators
export const getPlayerCardLabel = (
  name: string,
  position: string,
  team: string,
  projectedPoints: number,
  value: number
): string => {
  return `${name}, ${position} for ${team}. Projected ${projectedPoints} points. Value: ${value} dollars.`;
};

export const getTeamRosterLabel = (
  teamName: string,
  playerCount: number,
  budget: number,
  remaining: number
): string => {
  return `${teamName}. ${playerCount} players. Budget: ${budget} dollars. ${remaining} dollars remaining.`;
};

export const getBidButtonLabel = (amount: number, currentBid: number): string => {
  return `Bid ${amount} dollars. Current bid is ${currentBid} dollars.`;
};

// Visual focus indicator
export const addFocusIndicator = () => {
  const style = document.createElement('style');
  style.textContent = `
    *:focus-visible {
      outline: 2px solid hsl(var(--primary));
      outline-offset: 2px;
    }

    .focus-visible-ring:focus-visible {
      ring: 2px;
      ring-color: hsl(var(--primary));
      ring-offset: 2px;
    }
  `;
  document.head.appendChild(style);
};

// Initialize accessibility features
export const initAccessibility = () => {
  createAnnouncer();
  addFocusIndicator();

  // Add skip link
  const mainContent = document.getElementById('root');
  if (mainContent) {
    mainContent.setAttribute('role', 'main');
    mainContent.setAttribute('id', 'main-content');
    const skipLink = createSkipLink('main-content');
    document.body.insertBefore(skipLink, document.body.firstChild);
  }
};

export default {
  announce,
  announceDraftPick,
  announceBid,
  announceTimer,
  announcePlayerOnBlock,
  trapFocus,
  getFocusableElements,
  prefersReducedMotion,
  prefersHighContrast,
  initAccessibility,
};
