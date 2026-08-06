/**
 * Environment configuration — no secrets in code.
 * All values come from EXPO_PUBLIC_* env vars at build time.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  useSupabase: process.env.EXPO_PUBLIC_USE_SUPABASE === 'true',
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  /** When true, publish uses field-trust tier merge instead of legacy fill-only paths. */
  genericSourceFieldTrustMerge:
    process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE === 'true',
  /**
   * Phase 4.8.5 — integrated unified website shadow inside existing website processor.
   * Defaults off. Requires explicit source allowlist.
   */
  unifiedWebsiteIntegratedShadowEnabled:
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_INTEGRATED_SHADOW_ENABLED === 'true',
  unifiedWebsiteIntegratedShadowSourceIds: (
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_INTEGRATED_SHADOW_SOURCE_IDS ?? ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  unifiedWebsiteIntegratedShadowSampleLimit: Number.parseInt(
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_INTEGRATED_SHADOW_SAMPLE_LIMIT ?? '200',
    10,
  ),
  unifiedWebsiteIntegratedShadowNoWrite:
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_INTEGRATED_SHADOW_NO_WRITE !== 'false',
  /** Phase 4.8.6 — controlled Unified website publishing (separate from shadow flags). */
  unifiedWebsitePublishEnabled:
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_ENABLED === 'true',
  unifiedWebsitePublishSourceIds: (
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_SOURCE_IDS ?? ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  unifiedWebsitePublishEventIds: (
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_EVENT_IDS ?? ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  unifiedWebsitePublishFields: (
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_FIELDS ?? ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  unifiedWebsitePublishDryRun:
    process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_DRY_RUN !== 'false',
} as const;

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}
