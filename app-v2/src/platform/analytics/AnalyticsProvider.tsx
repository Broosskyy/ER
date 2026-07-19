import { usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { acceptAnalyticsConsent,
  readConsentState,
  revokeAnalyticsConsent,
} from '@/platform/analytics/consent-storage';
import { consentStateToGtag } from '@/platform/analytics/consent-types';
import {
  getGa4MeasurementId,
  isAnalyticsFeatureEnabled,
  loadGa4Script,
  setDefaultGtagConsent,
  shouldLoadAnalytics,
  trackGa4PageView,
  updateGtagConsent,
} from '@/platform/analytics/ga4-client';
import { useNetworkStatus } from '@/platform/network/use-network-status';

function CookieConsentBanner({
  onAccept,
  onReject,
}: {
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <AppText style={styles.title}>Datenschutz & Analyse</AppText>
      <AppText style={styles.body}>
        Wir verwenden optionale Analyse-Cookies, um die Nutzung der Web-App zu verstehen und
        technische Probleme zu erkennen. Du kannst zustimmen oder ablehnen. Notwendige Funktionen
        funktionieren in jedem Fall.
      </AppText>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onReject} style={styles.secondaryButton}>
          <AppText style={styles.secondaryText}>Ablehnen</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAccept} style={styles.primaryButton}>
          <AppText style={styles.primaryText}>Analyse erlauben</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOnline } = useNetworkStatus();
  const [consentResolved, setConsentResolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isAnalyticsFeatureEnabled()) {
      return;
    }

    setDefaultGtagConsent();
    const existing = readConsentState();

    const timer = setTimeout(() => {
      if (existing) {
        updateGtagConsent(consentStateToGtag(existing));
        if (shouldLoadAnalytics(existing.analytics === 'granted')) {
          const measurementId = getGa4MeasurementId();
          if (measurementId) {
            loadGa4Script(measurementId);
            setAnalyticsReady(true);
          }
        }
        setConsentResolved(true);
        return;
      }

      setShowBanner(true);
      setConsentResolved(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !analyticsReady || typeof document === 'undefined') {
      return;
    }
    trackGa4PageView(pathname, document.title);
  }, [analyticsReady, pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !analyticsReady) {
      return;
    }
    if (!isOnline) {
      return;
    }
  }, [analyticsReady, isOnline]);

  const handleAccept = () => {
    const state = acceptAnalyticsConsent();
    updateGtagConsent(consentStateToGtag(state));
    const measurementId = getGa4MeasurementId();
    if (measurementId) {
      loadGa4Script(measurementId);
      setAnalyticsReady(true);
    }
    setShowBanner(false);
  };

  const handleReject = () => {
    revokeAnalyticsConsent();
    updateGtagConsent({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    setShowBanner(false);
  };

  if (Platform.OS !== 'web' || !isAnalyticsFeatureEnabled()) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {consentResolved && showBanner ? (
        <CookieConsentBanner onAccept={handleAccept} onReject={handleReject} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'fixed' as unknown as 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    zIndex: 2000,
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  body: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  primaryText: {
    ...textRoles.metadata,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  secondaryText: {
    ...textRoles.metadata,
    color: colors.textPrimary,
  },
});
