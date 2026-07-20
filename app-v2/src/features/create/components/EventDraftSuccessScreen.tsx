import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { AdminEventRecord } from '@/data/types/records';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  getContributorEventEditRoute,
  getContributorEventPreviewRoute,
} from '@/features/create/constants/contributor-event-routes';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export function EventDraftSuccessScreen() {
  useWebPageTitle('webTitles.createEventSuccess');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === 'string' ? params.id : undefined;
  const [draft, setDraft] = useState<AdminEventRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref('/create/event') as '/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user?.id || !eventId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void contributorEventService.getEvent(eventId, user.id).then((record) => {
      if (!cancelled) {
        setDraft(record?.status === 'draft' ? record : null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, user?.id]);

  if (!eventId) {
    return <Redirect href="/create" />;
  }

  if (authLoading || loading) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!isAuthenticated || !user || !draft) {
    return <Redirect href="/create" />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.content}>
            <AppText accessibilityRole="header" style={styles.title}>
              {t('create.event.success.title')}
            </AppText>
            <AppText style={styles.message}>{t('create.event.success.message')}</AppText>
            <View style={styles.summaryCard}>
              <AppText style={styles.summaryLabel}>{t('create.event.success.eventName')}</AppText>
              <AppText style={styles.summaryValue}>{draft.title}</AppText>
              <AppText style={styles.summaryLabel}>{t('create.event.success.status')}</AppText>
              <AppText style={styles.summaryValue}>{t('create.event.success.statusDraft')}</AppText>
            </View>
            <PrimaryButton
              label={t('create.event.success.editDraft')}
              onPress={() => router.replace(getContributorEventEditRoute(draft.id))}
            />
            <SecondaryButton
              label={t('create.event.success.preview')}
              onPress={() => router.push(getContributorEventPreviewRoute(draft.id))}
            />
            <SecondaryButton
              label={t('create.event.success.backToCreate')}
              onPress={() => router.replace('/create')}
            />
            <SecondaryButton
              label={t('create.event.success.createAnother')}
              onPress={() => router.replace('/create/event')}
            />
          </View>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...textRoles.screenTitle,
  },
  message: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
  summaryCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  summaryLabel: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
