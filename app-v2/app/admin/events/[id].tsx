import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord, AdminEventStatus } from '@/data/types/records';
import {
  adminEventModerationService,
  adminEventRepository,
  cityRepository,
  collectionRepository,
  genreRepository,
  sourceRepository,
  venueRepository,
} from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { canModerateContributorEvents, canPublishEvents } from '@/features/admin/admin-permissions';
import { isContributorSubmission } from '@/features/admin/constants/admin-event-status';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { FilterChip } from '@/features/home/components/FilterChip';
import { filterConfig } from '@/features/search/config/filter-config';

const STATUSES: AdminEventStatus[] = ['draft', 'review', 'published', 'rejected', 'archived'];
const ADMIN_EVENTS_LIST_ROUTE = '/admin/events' as const;

function getSaveSuccessMessage(status: AdminEventStatus): string {
  switch (status) {
    case 'published':
      return 'Event published successfully.';
    case 'draft':
      return 'Event saved as draft.';
    case 'archived':
      return 'Event archived.';
    case 'review':
      return 'Event submitted for review.';
    case 'rejected':
      return 'Event rejected.';
    default:
      return 'Event saved successfully.';
  }
}

function createEmptyEvent(id: string): AdminEventRecord {
  const now = new Date().toISOString();
  return {
    id,
    title: '',
    description: '',
    cityId: filterConfig.defaultCityId,
    startDate: now,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export default function AdminEventEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, role } = useAdminAuth();
  const isNew = id === 'new';
  const canPublish = canPublishEvents(role);
  const canModerate = canModerateContributorEvents(role);
  const [record, setRecord] = useState<AdminEventRecord | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [genreOptions, setGenreOptions] = useState<{ id: string; label: string }[]>([]);
  const [cityOptions, setCityOptions] = useState<{ id: string; label: string }[]>([]);
  const draftEventIdRef = useRef(`event-${Date.now()}`);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [genres, cities, venues, sources, collections] = await Promise.all([
        genreRepository.getActive(),
        cityRepository.getActive(),
        venueRepository.getAll(),
        sourceRepository.getAll(),
        collectionRepository.getActive(),
      ]);
      setGenreOptions(genres.map((g) => ({ id: g.id, label: g.name })));
      setCityOptions(cities.map((c) => ({ id: c.id, label: c.name })));
      void venues;
      void sources;
      void collections;
      setOptionsLoaded(true);

      if (isNew) {
        setRecord((current) => current ?? createEmptyEvent(draftEventIdRef.current));
      } else {
        const existing = await adminEventRepository.getById(id);
        if (!existing) {
          setError('Event not found.');
          return;
        }
        setRecord((current) => (current?.id === existing.id ? current : existing));
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const updateField = <K extends keyof AdminEventRecord>(key: K, value: AdminEventRecord[K]) => {
    setRecord((current) => (current ? { ...current, [key]: value } : current));
  };

  const navigateToEventList = useCallback(
    (message: string) => {
      setSuccess(message);
      setTimeout(() => {
        router.replace(ADMIN_EVENTS_LIST_ROUTE);
      }, 700);
    },
    [router],
  );

  const save = async (status?: AdminEventStatus) => {
    if (!record) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextStatus = status ?? record.status;
      if (nextStatus === 'published' && !canPublish) {
        throw new Error('Your role cannot publish events.');
      }

      const payload = {
        ...record,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      await adminEventRepository.save(payload);
      navigateToEventList(getSaveSuccessMessage(nextStatus));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const publishContributorSubmission = async () => {
    if (!session || !record) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await adminEventModerationService.publishContributorEvent(session, record.id);
      navigateToEventList('Event published successfully.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const rejectContributorSubmission = async () => {
    if (!session || !record) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await adminEventModerationService.rejectContributorEvent(session, record.id);
      navigateToEventList('Event rejected.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const isContributorReview =
    record?.status === 'review' && isContributorSubmission(record);
  const editableStatuses = isContributorReview
    ? (['review'] as AdminEventStatus[])
    : STATUSES.filter((status) => status !== 'published' || canPublish);

  const remove = async () => {
    if (!record) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await adminEventRepository.delete(record.id);
      navigateToEventList(getSaveSuccessMessage('archived'));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !record || !optionsLoaded) {
    return <AdminLoadingState label="Loading event…" />;
  }

  if (error && !record.title) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{isNew ? 'New Event' : 'Edit Event'}</AppText>
          </View>

          <Field label="Title">
            <TextInput
              value={record.title}
              onChangeText={(value) => updateField('title', value)}
              style={styles.input}
            />
          </Field>
          <Field label="Description">
            <TextInput
              value={record.description}
              onChangeText={(value) => updateField('description', value)}
              multiline
              style={[styles.input, styles.multiline]}
            />
          </Field>
          <Field label="Start date (ISO)">
            <TextInput
              value={record.startDate}
              onChangeText={(value) => updateField('startDate', value)}
              style={styles.input}
            />
          </Field>
          <Field label="Ticket URL">
            <TextInput
              value={record.ticketUrl ?? ''}
              onChangeText={(value) => updateField('ticketUrl', value)}
              style={styles.input}
            />
          </Field>
          <Field label="Image URL">
            <TextInput
              value={record.imageUrl ?? ''}
              onChangeText={(value) => updateField('imageUrl', value)}
              style={styles.input}
            />
          </Field>

          <AppText style={styles.section}>Genre</AppText>
          <View style={styles.chips}>
            {genreOptions.map((option) => (
              <FilterChip
                key={option.id}
                label={option.label}
                selected={record.genreId === option.id}
                onPress={() => updateField('genreId', option.id)}
              />
            ))}
          </View>

          <AppText style={styles.section}>City</AppText>
          <View style={styles.chips}>
            {cityOptions.map((option) => (
              <FilterChip
                key={option.id}
                label={option.label}
                selected={record.cityId === option.id}
                onPress={() => updateField('cityId', option.id)}
              />
            ))}
          </View>

          <AppText style={styles.section}>Status</AppText>
          {isContributorReview ? (
            <AppText style={styles.moderationHint}>
              Contributor submission in review. Use moderation actions below or open the review
              queue for full context.
            </AppText>
          ) : null}
          <View style={styles.chips}>
            {editableStatuses.map((status) => (
              <FilterChip
                key={status}
                label={status}
                selected={record.status === status}
                onPress={() => updateField('status', status)}
              />
            ))}
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          <PrimaryButton
            label={saving ? 'Saving…' : 'Save'}
            onPress={() => save()}
            disabled={saving || isContributorReview}
          />
          {!isContributorReview ? (
            <SecondaryButton label="Save as Draft" onPress={() => save('draft')} disabled={saving} />
          ) : null}
          {isContributorReview && canModerate ? (
            <>
              <PrimaryButton
                label={saving ? 'Publishing…' : 'Publish submission'}
                onPress={publishContributorSubmission}
                disabled={saving}
              />
              <SecondaryButton
                label={saving ? 'Rejecting…' : 'Reject submission'}
                onPress={rejectContributorSubmission}
                disabled={saving}
              />
              <SecondaryButton
                label="Open review detail"
                onPress={() => router.push(`/admin/events/review/${record.id}`)}
                disabled={saving}
              />
            </>
          ) : null}
          {!isContributorReview && canPublish ? (
            <SecondaryButton label="Publish" onPress={() => save('published')} disabled={saving} />
          ) : null}
          {!isContributorReview ? (
            <SecondaryButton label="Archive" onPress={() => save('archived')} disabled={saving} />
          ) : null}
          {!isNew ? (
            <SecondaryButton label="Delete" onPress={remove} disabled={saving} />
          ) : null}
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacingRoles.screenHorizontal,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...textRoles.sectionTitle, flex: 1 },
  field: { gap: spacing.xs },
  label: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  section: { ...textRoles.metadata, fontWeight: '600' },
  moderationHint: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
});
