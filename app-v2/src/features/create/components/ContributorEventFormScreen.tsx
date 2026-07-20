import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage, AppError } from '@/core/errors/app-error';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { EventDraftForm } from '@/features/create/components/EventDraftForm';
import {
  CONTRIBUTOR_EVENT_CREATE_ROUTE,
  getContributorEventEditRoute,
  getContributorEventPreviewRoute,
} from '@/features/create/constants/contributor-event-routes';
import { useEventDraftFormLabels } from '@/features/create/hooks/useEventDraftFormLabels';
import { useEventDraftFormState } from '@/features/create/hooks/useEventDraftFormState';
import { useEventDraftReferenceData } from '@/features/create/hooks/useEventDraftReferenceData';
import { mapAdminRecordToEventDraftForm } from '@/features/create/mappers/event-draft-mapper';
import {
  createContributorEvent,
  contributorEventService,
  updateContributorEvent,
} from '@/features/create/services/contributor-event-service';
import type {
  EventDraftValidationKey,
  EventImageField,
} from '@/features/create/types/event-draft-form';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export interface ContributorEventFormScreenProps {
  mode: 'create' | 'edit';
  eventId?: string;
}

export function ContributorEventFormScreen({ mode, eventId }: ContributorEventFormScreenProps) {
  useWebPageTitle(mode === 'create' ? 'webTitles.createEvent' : 'webTitles.editEvent');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: referenceData, loading: optionsLoading } = useEventDraftReferenceData();
  const { form, fieldErrors, setFieldValue, validate, resetForm } = useEventDraftFormState();
  const { formLabels, imageLabels } = useEventDraftFormLabels(mode);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(mode === 'edit');
  const [imageErrors, setImageErrors] = useState<Partial<Record<EventImageField, string>>>({});

  const loginReturnPath =
    mode === 'edit' && eventId ? getContributorEventEditRoute(eventId) : CONTRIBUTOR_EVENT_CREATE_ROUTE;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref(loginReturnPath) as '/login');
    }
  }, [authLoading, isAuthenticated, loginReturnPath, router]);

  const linkLabels = useMemo(
    () => ({
      website: t('create.event.form.labels.website'),
      instagram: t('create.event.form.labels.instagram'),
      facebook: t('create.event.form.labels.facebook'),
    }),
    [t],
  );

  useEffect(() => {
    if (mode !== 'edit' || !eventId || !user?.id) {
      setLoadingDraft(false);
      return;
    }

    let cancelled = false;
    void contributorEventService.getEvent(eventId, user.id).then((record) => {
      if (cancelled) {
        return;
      }
      if (!record || record.status !== 'draft') {
        router.replace('/create');
        return;
      }
      resetForm(mapAdminRecordToEventDraftForm(record, linkLabels));
      setLoadingDraft(false);
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, linkLabels, mode, resetForm, router, user?.id]);

  const translateError = useCallback(
    (key?: EventDraftValidationKey) => (key ? t(key) : undefined),
    [t],
  );

  const persistDraft = useCallback(async () => {
    if (!user) {
      throw new AppError('Authentication required.');
    }

    if (mode === 'edit' && eventId) {
      return updateContributorEvent({
        eventId,
        form,
        userId: user.id,
        linkLabels,
      });
    }

    return createContributorEvent({
      form,
      userId: user.id,
      linkLabels,
    });
  }, [eventId, form, linkLabels, mode, user]);

  const handleSaveDraft = async () => {
    if (!user || submitting) {
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const saved = await persistDraft();
      if (mode === 'create') {
        router.replace(getContributorEventEditRoute(saved.id));
        return;
      }
    } catch (cause) {
      setSubmitError(getErrorMessage(cause) || t('create.event.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = async () => {
    if (!user || submitting) {
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const saved = await persistDraft();
      router.push(getContributorEventPreviewRoute(saved.id));
    } catch (cause) {
      setSubmitError(getErrorMessage(cause) || t('create.event.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || optionsLoading || loadingDraft) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <AppText style={styles.loadingText}>{t('common.labels.loading')}</AppText>
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.header}>
            <IconButton
              icon="arrow-back"
              accessibilityLabel={t('common.actions.back')}
              onPress={() => router.back()}
            />
          </View>
          <EventDraftForm
            mode={mode}
            form={form}
            fieldErrors={fieldErrors}
            genreOptions={referenceData.genreOptions}
            venues={referenceData.venues}
            labels={formLabels}
            imageLabels={imageLabels}
            submitting={submitting}
            submitError={submitError}
            imageErrors={imageErrors}
            onFieldChange={setFieldValue}
            onImageChange={(field, value) => setFieldValue(field, value)}
            onImageError={(field, message) =>
              setImageErrors((current) => ({ ...current, [field]: message }))
            }
            onSubmit={() => void handleSaveDraft()}
            onPreview={() => void handlePreview()}
            translateError={translateError}
          />
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
    gap: spacing.md,
  },
  loadingText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
});
