import { describe, it, expect } from 'vitest';
import { isDevelopment, isProduction, isStaging, debugLog } from '@/lib/env';

describe('Environment Configuration', () => {
  it('isDevelopment returns boolean', () => {
    expect(typeof isDevelopment()).toBe('boolean');
  });

  it('isProduction returns boolean', () => {
    expect(typeof isProduction()).toBe('boolean');
  });

  it('isStaging returns boolean', () => {
    expect(typeof isStaging()).toBe('boolean');
  });

  it('only one environment can be active at a time', () => {
    const envStates = [isDevelopment(), isStaging(), isProduction()];
    const activeCount = envStates.filter(Boolean).length;

    // At most one should be true (or none if using a different env)
    expect(activeCount).toBeLessThanOrEqual(1);
  });

  it('debugLog does not throw', () => {
    expect(() => {
      debugLog('test message');
      debugLog('test with data', { key: 'value' });
    }).not.toThrow();
  });
});
