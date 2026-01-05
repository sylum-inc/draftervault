/**
 * Centralized logging utility for Draft Vault
 * Provides structured logging with different levels and context
 */

import { captureError, addBreadcrumb } from './sentry';
import { env, isProduction } from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output (suppress in production except errors)
    if (!isProduction() || level === 'error') {
      const formattedMessage = this.formatMessage(level, message, context);
      switch (level) {
        case 'debug':
          if (env.VITE_DEBUG) console.debug(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
          console.error(formattedMessage, error);
          break;
      }
    }

    // Add breadcrumb for Sentry
    if (level !== 'debug') {
      addBreadcrumb(message, context?.component || 'app', context);
    }

    // Capture errors in Sentry
    if (level === 'error' && error) {
      captureError(error, context);
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error);
  }

  // Get recent logs for debugging
  getRecentLogs(count = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear logs
  clear() {
    this.logs = [];
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) =>
  logger.error(message, error, context);

// API request/response logging
export const logApiRequest = (
  method: string,
  url: string,
  options?: { body?: unknown; headers?: Record<string, string> }
) => {
  logger.debug(`API Request: ${method} ${url}`, {
    component: 'api',
    action: 'request',
    method,
    url,
    hasBody: !!options?.body,
  });
};

export const logApiResponse = (
  method: string,
  url: string,
  status: number,
  duration: number,
  success: boolean
) => {
  const level = success ? 'debug' : 'warn';
  logger[level](`API Response: ${method} ${url} - ${status} (${duration}ms)`, {
    component: 'api',
    action: 'response',
    method,
    url,
    status,
    duration,
    success,
  });
};

export const logApiError = (method: string, url: string, error: Error) => {
  logger.error(`API Error: ${method} ${url}`, error, {
    component: 'api',
    action: 'error',
    method,
    url,
  });
};

// Draft event logging
export const logDraftEvent = (
  event: 'pick' | 'bid' | 'nominate' | 'undo' | 'trade' | 'start' | 'end',
  data: Record<string, unknown>
) => {
  logger.info(`Draft Event: ${event}`, {
    component: 'draft',
    action: event,
    ...data,
  });
};

// Performance logging
export const logPerformance = (metric: string, value: number, context?: LogContext) => {
  logger.debug(`Performance: ${metric} = ${value}ms`, {
    component: 'performance',
    metric,
    value,
    ...context,
  });
};

export default logger;
