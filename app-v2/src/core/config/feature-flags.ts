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
  /**
   * When true, ImportEventPublishService uses FieldTrustMergeService for canonical field updates.
   * Default false — legacy merge paths preserve production behaviour until validated.
   */
  get genericSourceFieldTrustMerge(): boolean {
    return env.genericSourceFieldTrustMerge;
  },
  /** Phase 4.8.5 — run unified website extraction in parallel inside website processor (shadow only). */
  get unifiedWebsiteIntegratedShadowEnabled(): boolean {
    return env.unifiedWebsiteIntegratedShadowEnabled;
  },
  get unifiedWebsiteIntegratedShadowSourceIds(): readonly string[] {
    return env.unifiedWebsiteIntegratedShadowSourceIds;
  },
  get unifiedWebsiteIntegratedShadowSampleLimit(): number {
    return env.unifiedWebsiteIntegratedShadowSampleLimit;
  },
  get unifiedWebsiteIntegratedShadowNoWrite(): boolean {
    return env.unifiedWebsiteIntegratedShadowNoWrite;
  },
  /** Phase 4.8.6 — controlled Unified website field publishing (separate from shadow). */
  get unifiedWebsitePublishEnabled(): boolean {
    return env.unifiedWebsitePublishEnabled;
  },
  get unifiedWebsitePublishSourceIds(): readonly string[] {
    return env.unifiedWebsitePublishSourceIds;
  },
  get unifiedWebsitePublishEventIds(): readonly string[] {
    return env.unifiedWebsitePublishEventIds;
  },
  get unifiedWebsitePublishFields(): readonly string[] {
    return env.unifiedWebsitePublishFields;
  },
  get unifiedWebsitePublishDryRun(): boolean {
    return env.unifiedWebsitePublishDryRun;
  },
} as const;
