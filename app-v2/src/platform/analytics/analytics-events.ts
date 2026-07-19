/**
 * Analytics event catalog — names must not contain PII.
 * See docs/analytics.md for full definitions.
 */

export const STANDARD_ANALYTICS_EVENTS = {
  page_view: 'page_view',
  session_start: 'session_start',
  session_end: 'session_end',
  app_open: 'app_open',
  app_close: 'app_close',
  screen_view: 'screen_view',
  navigation: 'navigation',
  not_found: '404_page',
  error: 'error',
  performance_warning: 'performance_warning',
  offline_mode: 'offline_mode',
  online_mode: 'online_mode',
} as const;

export const CUSTOM_ANALYTICS_EVENTS = {
  event_opened: 'event_opened',
  event_favorited: 'event_favorited',
  event_unfavorited: 'event_unfavorited',
  notification_enabled: 'notification_enabled',
  notification_disabled: 'notification_disabled',
  admin_login: 'admin_login',
  admin_logout: 'admin_logout',
  admin_action: 'admin_action',
  search_started: 'search_started',
  search_completed: 'search_completed',
  settings_updated: 'settings_updated',
} as const;

export const CONVERSION_ANALYTICS_EVENTS = {
  favorite_saved: 'favorite_saved',
  pwa_installed: 'pwa_installed',
  app_opened: 'app_opened',
} as const;

export type StandardAnalyticsEvent =
  (typeof STANDARD_ANALYTICS_EVENTS)[keyof typeof STANDARD_ANALYTICS_EVENTS];
export type CustomAnalyticsEvent =
  (typeof CUSTOM_ANALYTICS_EVENTS)[keyof typeof CUSTOM_ANALYTICS_EVENTS];
export type ConversionAnalyticsEvent =
  (typeof CONVERSION_ANALYTICS_EVENTS)[keyof typeof CONVERSION_ANALYTICS_EVENTS];

export type AnalyticsEventName =
  | StandardAnalyticsEvent
  | CustomAnalyticsEvent
  | ConversionAnalyticsEvent;

export interface AnalyticsEventDefinition {
  name: AnalyticsEventName;
  description: string;
  purpose: string;
  trigger: string;
  dataFields: string[];
  consentRequired: boolean;
  privacyRating: 'low' | 'medium';
}

export const ANALYTICS_EVENT_CATALOG: AnalyticsEventDefinition[] = [
  {
    name: STANDARD_ANALYTICS_EVENTS.page_view,
    description: 'Page viewed',
    purpose: 'Measure navigation and popular pages',
    trigger: 'Route change on web',
    dataFields: ['page_path', 'page_title'],
    consentRequired: true,
    privacyRating: 'low',
  },
  {
    name: CUSTOM_ANALYTICS_EVENTS.event_opened,
    description: 'Event detail opened',
    purpose: 'Identify popular events',
    trigger: 'Event detail screen mount',
    dataFields: ['event_id'],
    consentRequired: true,
    privacyRating: 'low',
  },
  {
    name: CUSTOM_ANALYTICS_EVENTS.event_favorited,
    description: 'Event saved to favorites',
    purpose: 'Measure engagement',
    trigger: 'Favorite toggle on',
    dataFields: ['event_id'],
    consentRequired: true,
    privacyRating: 'low',
  },
  {
    name: CUSTOM_ANALYTICS_EVENTS.search_completed,
    description: 'Search submitted',
    purpose: 'Improve search relevance',
    trigger: 'Search query executed',
    dataFields: ['result_count'],
    consentRequired: true,
    privacyRating: 'low',
  },
  {
    name: CONVERSION_ANALYTICS_EVENTS.pwa_installed,
    description: 'PWA installed',
    purpose: 'Measure install rate',
    trigger: 'beforeinstallprompt accepted',
    dataFields: [],
    consentRequired: true,
    privacyRating: 'low',
  },
];
