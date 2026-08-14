import { env, isSupabaseConfigured } from '@/core/config/env';

/**
 * Central feature flags. UI must never branch on datasource details —
 * only repositories read these flags.
 */
export const featureFlags = {
  /** When true and Supabase is configured, repositories use Supabase datasources. */
  get useSupabase(): boolean {
    return env.useSupabase && isSupabaseConfigured();
  },
} as const;
