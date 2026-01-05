import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';
const IS_PRODUCTION = APP_ENV === 'production';

export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] No DSN provided, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    enabled: IS_PRODUCTION,

    // Performance monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.2 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: IS_PRODUCTION ? 0.1 : 0,
    replaysOnErrorSampleRate: IS_PRODUCTION ? 1.0 : 0,

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop',
      'ResizeObserver loop limit exceeded',
      // Network errors
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      // User aborted
      'AbortError',
      // Third-party scripts
      /^Script error\.?$/,
      /^Javascript error: Script error\.? on line 0$/,
    ],

    // Add context to errors
    beforeSend(event, hint) {
      // Don't send errors in development
      if (!IS_PRODUCTION) {
        console.error('[Sentry] Would send error:', hint.originalException);
        return null;
      }

      // Add draft state context if available
      const draftState = window.__DRAFT_STATE__;
      if (draftState) {
        event.contexts = {
          ...event.contexts,
          draft: {
            currentPick: draftState.currentPick,
            totalTeams: draftState.teams?.length,
            playersDrafted: draftState.draftedPlayers?.length,
          },
        };
      }

      return event;
    },

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
  });
};

// Error boundary wrapper
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Manual error capture
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Set user context
export const setUser = (user: { id: string; username?: string; email?: string } | null) => {
  Sentry.setUser(user);
};

// Add breadcrumb for debugging
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
};

// Track draft events
export const trackDraftEvent = (
  event: 'pick' | 'bid' | 'nominate' | 'undo' | 'trade',
  data: Record<string, unknown>
) => {
  addBreadcrumb(`Draft ${event}`, 'draft', data);
};

// Declare global for draft state
declare global {
  interface Window {
    __DRAFT_STATE__?: {
      currentPick: number;
      teams: unknown[];
      draftedPlayers: unknown[];
    };
  }
}

export default Sentry;
