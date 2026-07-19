import { Platform } from 'react-native';

import type { AnalyticsEventName } from '@/platform/analytics/analytics-events';
import { readConsentState } from '@/platform/analytics/consent-storage';
import { shouldLoadAnalytics, trackGa4Event } from '@/platform/analytics/ga4-client';

export function trackAnalyticsEvent(
  name: AnalyticsEventName,
  params?: Record<string, string | number | boolean>,
): void {
  if (Platform.OS !== 'web') {
    return;
  }

  const consent = readConsentState();
  if (!shouldLoadAnalytics(consent?.analytics === 'granted')) {
    return;
  }

  trackGa4Event(name, params);
}
