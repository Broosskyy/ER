import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { AppError, getErrorMessage } from '@/core/errors/app-error';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { EventDraftForm } from '@/features/create/components/EventDraftForm';
import {
  buildContributorEventSuccessHref,
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

function translateContributorError(
  cause: unknown,
  t: (key: EventDraftValidationKey | 'create.event.errors.generic') => string,
): string {
  if (cause instanceof AppError) {
    if (typeof cause.cause === 'string' && cause.cause.startsWith('create.event.errors.')) {
      return t(cause.cause as EventDraftValidationKey);
    }

    if (cause.cause && typeof cause.cause === 'object' && !Array.isArray(cause.cause)) {
      return t('create.event.errors.generic');
    }
  }

  return getErrorMessage(cause) || t('create.event.errors.generic');
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Partial<Record<EventImageField, string>>>({});
  const [savedDraftId, setSavedDraftId] = useState<string | undefined>(mode === 'edit' ? eventId : undefined);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const submitLockRef = useRef(false);

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
    setLoadingDraft(true);
    setLoadError(null);

    void contributorEventService
      .getEvent(eventId, user.id)
      .then((record) => {
        if (cancelled) {
          return;
        }

        if (!record || record.status !== 'draft') {
          router.replace('/create');
          return;
        }

        resetForm(mapAdminRecordToEventDraftForm(record, linkLabels));
        setSavedDraftId(record.id);
      })
      .catch((cause) => {
        if (!cancelled) {
          setLoadError(translateContributorError(cause, t));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDraft(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, linkLabels, mode, resetForm, router, t, user?.id]);

  const translateError = useCallback(
    (key?: EventDraftValidationKey) => (key ? t(key) : undefined),
    [t],
  );

  const persistDraft = useCallback(async () => {
    if (!user) {
      throw new AppError('Authentication required.');
    }

    const activeEventId = mode === 'edit' ? eventId : savedDraftId;

    if (activeEventId) {
      return updateContributorEvent({
        eventId: activeEventId,
        form,
        userId: user.id,
        linkLabels,
      });
    }

    const created = await createContributorEvent({
      form,
      userId: user.id,
      linkLabels,
    });
    setSavedDraftId(created.id);
    return created;
  }, [eventId, form, linkLabels, mode, savedDraftId, user]);

  const runPersist = async (onSuccess: (savedId: string) => void) => {
    if (!user || submitting || submitLockRef.current) {
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSaveSuccess(false);

    try {
      const saved = await persistDraft();
      setSaveSuccess(true);
      onSuccess(saved.id);
    } catch (cause) {
      setSubmitError(translateContributorError(cause, t));
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleSaveDraft = () =>
    void runPersist((savedId) => {
      if (mode === 'create') {
        router.replace(buildContributorEventSuccessHref(savedId) as '/create/event/success');
        return;
      }

      router.replace(buildContributorEventSuccessHref(savedId) as '/create/event/success');
    });

  const handlePreview = () =>
    void runPersist((savedId) => {
      router.push(getContributorEventPreviewRoute(savedId));
    });

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

  if (loadError) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.loadingContainer}>
          <AppText style={styles.errorText}>{loadError}</AppText>
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
          {saveSuccess && mode === 'edit' ? (
            <AppText style={styles.successBanner}>{t('create.event.success.message')}</AppText>
          ) : null}
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
            onSubmit={handleSaveDraft}
            onPreview={handlePreview}
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
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  loadingText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  errorText: {
    ...textRoles.body,
    color: colors.live,
    textAlign: 'center',
  },
  successBanner: {
    ...textRoles.metadata,
    color: colors.primary,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
});
