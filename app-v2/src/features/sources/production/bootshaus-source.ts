/**
 * @deprecated Test helpers only — production config lives in public.sources (migration 20260744000000).
 * Re-exports for backward-compatible test imports.
 */
export {
  PRODUCTION_BOOTSHAUS_SOURCE_ID as BOOTSHAUS_SOURCE_ID,
  BOOTSHAUS_WEBSITE_CONFIG,
  createBootshausProductionSourceRecord as createBootshausKoelnSourceRecord,
  createBootshausProductionSourceRecord as createBootshausKoelnLiveSourceRecord,
} from './production-source-records';

export const BOOTSHAUS_SOURCE_SLUG = 'bootshaus-koeln';
export const BOOTSHAUS_SOURCE_STABLE_KEY = 'bootshaus-koeln-website-v1';
export const BOOTSHAUS_SOURCE_CONNECTOR_KEY = 'club_website' as const;
export const BOOTSHAUS_EVENTS_URL = 'https://bootshaus.tv/events/';
