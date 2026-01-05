/**
 * Web Vitals monitoring for Draft Vault
 * Tracks Core Web Vitals and reports them for performance analysis
 */

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB, Metric } from 'web-vitals';
import { logPerformance } from './logger';
import { isProduction } from './env';

interface VitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

// Thresholds for Core Web Vitals
const thresholds = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

const getRating = (name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = thresholds[name as keyof typeof thresholds];
  if (!threshold) return 'good';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
};

const handleMetric = (metric: Metric) => {
  const vitalMetric: VitalMetric = {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    id: metric.id,
  };

  // Log locally
  logPerformance(metric.name, metric.value, {
    rating: vitalMetric.rating,
    delta: metric.delta,
  });

  // Send to analytics in production
  if (isProduction()) {
    sendToAnalytics(vitalMetric);
  }

  // Log to console in development
  if (!isProduction()) {
    const color =
      vitalMetric.rating === 'good'
        ? 'green'
        : vitalMetric.rating === 'needs-improvement'
          ? 'orange'
          : 'red';
    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${vitalMetric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }
};

const sendToAnalytics = (metric: VitalMetric) => {
  // Send to Google Analytics if available
  if (typeof window.gtag === 'function') {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
    });
  }

  // Send to custom analytics endpoint
  const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  if (analyticsEndpoint) {
    fetch(analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'web-vital',
        ...metric,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {
      // Silently fail - don't affect user experience
    });
  }
};

// Initialize Web Vitals monitoring
export const initWebVitals = () => {
  try {
    // Core Web Vitals
    onCLS(handleMetric);
    onFCP(handleMetric);
    onFID(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);

    console.log('[Web Vitals] Monitoring initialized');
  } catch (error) {
    console.warn('[Web Vitals] Failed to initialize:', error);
  }
};

// Get current performance metrics
export const getPerformanceMetrics = () => {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  return {
    // Navigation timing
    dns: navigation?.domainLookupEnd - navigation?.domainLookupStart,
    tcp: navigation?.connectEnd - navigation?.connectStart,
    ttfb: navigation?.responseStart - navigation?.requestStart,
    download: navigation?.responseEnd - navigation?.responseStart,
    domInteractive: navigation?.domInteractive - navigation?.fetchStart,
    domComplete: navigation?.domComplete - navigation?.fetchStart,
    load: navigation?.loadEventEnd - navigation?.fetchStart,

    // Paint timing
    firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime,
    firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime,

    // Memory (if available)
    memory: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
      ?.usedJSHeapSize,
  };
};

// Report long tasks
export const observeLongTasks = () => {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            logPerformance('long-task', entry.duration, {
              name: entry.name,
              startTime: entry.startTime,
            });
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // Long task observation not supported
    }
  }
};

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params: Record<string, unknown>) => void;
  }
}

export default initWebVitals;
