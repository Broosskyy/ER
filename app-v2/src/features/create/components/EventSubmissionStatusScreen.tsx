import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import {
  SubmissionProgress,
  SubmissionStatusBanner,
} from '@/components/organizer/SubmissionComponents';
import type { AdminEventRecord } from '@/data/types/records';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { PROFILE_MY_EVENTS_ROUTE } from '@/features/create/constants/contributor-event-routes';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import {
  resolveEventSubmission,
} from '@/features/create/wizard/event-submission-service';
import {
  buildSubmissionFromAdminEvent,
  buildSubmissionTimelineSteps,
  resolveSubmissionDisplayStatus,
  resolveSubmissionTimelineLabel,
} from '@/features/create/wizard/submission-status-timeline';
import type { EventSubmission } from '@/features/create/wizard/wizard-types';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export function EventSubmissionStatusScreen() {
  useWebPageTitle('webTitles.eventSubmitted');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const submissionOrEventId = typeof params.id === 'string' ? params.id : undefined;
  const [submission, setSubmission] = useState<EventSubmission | null>(null);
  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref('/create') as '/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!submissionOrEventId || !user?.id) {
      return;
    }

    void (async () => {
      const [resolvedSubmission, loadedEvent] = await Promise.all([
        resolveEventSubmission(submissionOrEventId),
        contributorEventService.getEvent(submissionOrEventId, user.id).catch(() => null),
      ]);

      const eventRecord =
        loadedEvent ??
        (resolvedSubmission
          ? await contributorEventService.getEvent(resolvedSubmission.eventId, user.id)
          : null);

      setSubmission(
        resolvedSubmission ??
          (eventRecord ? buildSubmissionFromAdminEvent(eventRecord) : null),
      );
      setEvent(eventRecord);
      setLoading(false);
    })();
  }, [submissionOrEventId, user?.id]);

  const displayStatus = useMemo(() => {
    if (!submission) {
      return null;
    }
    return resolveSubmissionDisplayStatus(submission, event);
  }, [event, submission]);

  const timelineSteps = useMemo(() => {
    if (!displayStatus) {
      return [];
    }
    return buildSubmissionTimelineSteps(displayStatus);
  }, [displayStatus]);

  if (!submissionOrEventId) {
    return <Redirect href="/create" />;
  }

  if (authLoading || loading) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!submission || !displayStatus) {
    return <Redirect href="/create" />;
  }

  const snapshot = submission.eventSnapshot as { title?: string };
  const bannerStatus = mapDisplayStatusToBannerStatus(displayStatus);

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.header}>
            <IconButton
              icon="arrow-back"
              accessibilityLabel={t('common.actions.back')}
              onPress={() => router.back()}
            />
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SubmissionStatusBanner
              status={bannerStatus}
              title={t(`submissionStatus.banner.${displayStatus}.title`, {
                defaultValue: resolveSubmissionTimelineLabel(displayStatus),
              })}
              message={t(`submissionStatus.banner.${displayStatus}.message`, {
                defaultValue: t('submissionStatus.banner.defaultMessage'),
              })}
            />

            <AppText accessibilityRole="header" style={styles.title}>
              {snapshot.title ?? event?.title ?? t('submissionStatus.untitledEvent')}
            </AppText>

            <SubmissionProgress steps={timelineSteps} />

            <Stack gap="sm">
              <MetaRow
                label={t('submissionStatus.meta.status')}
                value={resolveSubmissionTimelineLabel(displayStatus)}
              />
              <MetaRow
                label={t('submissionStatus.meta.submittedAt')}
                value={new Date(submission.submittedAt).toLocaleString('de-DE')}
              />
              <MetaRow
                label={t('submissionStatus.meta.updatedAt')}
                value={new Date(submission.updatedAt).toLocaleString('de-DE')}
              />
            </Stack>

            <View style={styles.timeline}>
              <AppText role="sectionTitle">{t('submissionStatus.history.title')}</AppText>
              {submission.history.map((entry) => (
                <AppText key={`${entry.status}-${entry.at}`} role="caption">
                  {resolveSubmissionTimelineLabel(entry.status)} —{' '}
                  {new Date(entry.at).toLocaleString('de-DE')}
                </AppText>
              ))}
            </View>

            {event?.status === 'published' ? (
              <PrimaryButton
                label={t('events.actions.viewPublic')}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ) : null}

            <PrimaryButton
              label={t('submissionStatus.actions.myEvents')}
              onPress={() => router.push(PROFILE_MY_EVENTS_ROUTE)}
            />
            <SecondaryButton
              label={t('submissionStatus.actions.createEvent')}
              onPress={() => router.replace('/create/event')}
            />
            <SecondaryButton
              label={t('submissionStatus.actions.backToProfile')}
              onPress={() => router.replace('/(tabs)/profile')}
            />
          </ScrollView>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

function mapDisplayStatusToBannerStatus(
  status: ReturnType<typeof resolveSubmissionDisplayStatus>,
): 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected' | 'published' {
  if (status === 'draft') {
    return 'draft';
  }
  if (status === 'needs_changes' || status === 'rejected') {
    return 'changes_requested';
  }
  if (status === 'published' || status === 'approved') {
    return status === 'published' ? 'published' : 'approved';
  }
  if (status === 'archived' || status === 'cancelled') {
    return 'draft';
  }
  return 'submitted';
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <AppText style={styles.metaLabel}>{label}</AppText>
      <AppText style={styles.metaValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
  },
  title: { ...textRoles.screenTitle },
  metaRow: { gap: spacing.xs },
  metaLabel: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  metaValue: { ...textRoles.body },
  timeline: { gap: spacing.xs },
});
