/**
 * Environment configuration with validation
 * All environment variables should be accessed through this module
 */

import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Application
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_APP_URL: z.string().url().optional(),

  // API Keys
  VITE_RAPIDAPI_KEY: z.string().optional(),
  VITE_SPORTSDATA_KEY: z.string().optional(),

  // Error Monitoring
  VITE_SENTRY_DSN: z.string().optional(),

  // Real-time
  VITE_WS_URL: z.string().optional(),

  // Analytics
  VITE_GA_MEASUREMENT_ID: z.string().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),

  // Feature Flags
  VITE_USE_MOCK_DATA: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  VITE_DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  VITE_ENABLE_EXPERIMENTS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

type EnvConfig = z.infer<typeof envSchema>;

// Parse and validate environment variables
const parseEnv = (): EnvConfig => {
  const envVars = {
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
    VITE_RAPIDAPI_KEY: import.meta.env.VITE_RAPIDAPI_KEY,
    VITE_SPORTSDATA_KEY: import.meta.env.VITE_SPORTSDATA_KEY,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_WS_URL: import.meta.env.VITE_WS_URL,
    VITE_GA_MEASUREMENT_ID: import.meta.env.VITE_GA_MEASUREMENT_ID,
    VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY,
    VITE_USE_MOCK_DATA: import.meta.env.VITE_USE_MOCK_DATA,
    VITE_DEBUG: import.meta.env.VITE_DEBUG,
    VITE_ENABLE_EXPERIMENTS: import.meta.env.VITE_ENABLE_EXPERIMENTS,
  };

  const result = envSchema.safeParse(envVars);

  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    // Return defaults on failure in development
    if (import.meta.env.DEV) {
      return envSchema.parse({});
    }
    throw new Error('Invalid environment configuration');
  }

  return result.data;
};

// Export validated environment config
export const env = parseEnv();

// Helper functions
export const isDevelopment = () => env.VITE_APP_ENV === 'development';
export const isStaging = () => env.VITE_APP_ENV === 'staging';
export const isProduction = () => env.VITE_APP_ENV === 'production';

export const hasApiKey = (key: 'rapidapi' | 'sportsdata'): boolean => {
  switch (key) {
    case 'rapidapi':
      return !!env.VITE_RAPIDAPI_KEY;
    case 'sportsdata':
      return !!env.VITE_SPORTSDATA_KEY;
    default:
      return false;
  }
};

export const getApiKey = (key: 'rapidapi' | 'sportsdata'): string | undefined => {
  switch (key) {
    case 'rapidapi':
      return env.VITE_RAPIDAPI_KEY;
    case 'sportsdata':
      return env.VITE_SPORTSDATA_KEY;
    default:
      return undefined;
  }
};

// Debug logging helper
export const debugLog = (...args: unknown[]) => {
  if (env.VITE_DEBUG || isDevelopment()) {
    console.log('[DEBUG]', ...args);
  }
};

export default env;
