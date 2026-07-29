import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import type { AdminEventRecord, AdminEventStatus, VenueRecord, OrganizerRecord } from '@/data/types/records';
import {
  adminEventModerationService,
  adminEventRepository,
  adminArtistRepository,
  cityRepository,
  collectionRepository,
  eventLineupService,
  genreRepository,
  organizerRepository,
  sourceRepository,
  venueRepository,
  eventLifecycleAdminService,
} from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import {
  EventLineupEditor,
  type EventLineupDraftEntry,
} from '@/features/admin/components/EventLineupEditor';
import { VenuePicker } from '@/features/admin/components/VenuePicker';
import { OrganizerPicker } from '@/features/admin/components/OrganizerPicker';
import { canEditEventLineup, canEditEvents, canModerateContributorEvents, canPublishEvents } from '@/features/admin/admin-permissions';
import {
  assertValidAdminEditorialTransition,
  isContributorReviewEvent,
} from '@/features/admin/constants/admin-event-status';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { FilterChip } from '@/features/home/components/FilterChip';
import type { EventLifecycleAdminStatus } from '@/features/event-lifecycle/services/event-lifecycle-admin-service';
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
  const canEdit = canEditEvents(role);
  const canModerate = canModerateContributorEvents(role);
  const canEditLineup = canEditEventLineup(role);
  const [record, setRecord] = useState<AdminEventRecord | null>(null);
  const [lineup, setLineup] = useState<EventLineupDraftEntry[]>([]);
  const [artistOptions, setArtistOptions] = useState<Awaited<ReturnType<typeof adminArtistRepository.getAll>>>([]);
  const [venueOptions, setVenueOptions] = useState<VenueRecord[]>([]);
  const [organizerOptions, setOrganizerOptions] = useState<OrganizerRecord[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [genreOptions, setGenreOptions] = useState<{ id: string; label: string }[]>([]);
  const [cityOptions, setCityOptions] = useState<{ id: string; label: string }[]>([]);
  const [draftEventId] = useState(() => `event-${Date.now()}`);
  const [lifecycleStatus, setLifecycleStatus] = useState<EventLifecycleAdminStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [genres, cities, venues, organizers, sources, collections, artists] = await Promise.all([
        genreRepository.getActive(),
        cityRepository.getActive(),
        venueRepository.getAll(),
        organizerRepository.getAll(),
        sourceRepository.getAll(),
        collectionRepository.getActive(),
        adminArtistRepository.getAll(),
      ]);
      setGenreOptions(genres.map((g) => ({ id: g.id, label: g.name })));
      setCityOptions(cities.map((c) => ({ id: c.id, label: c.name })));
      setArtistOptions(artists);
      setVenueOptions(venues);
      setOrganizerOptions(organizers);
      void sources;
      void collections;
      setOptionsLoaded(true);

      if (isNew) {
        setRecord((current) => current ?? createEmptyEvent(draftEventId));
        setLineup([]);
      } else {
        const existing = await adminEventRepository.getById(id);
        if (!existing) {
          setError('Event not found.');
          return;
        }
        setRecord((current) => (current?.id === existing.id ? current : existing));
        setLifecycleStatus(await eventLifecycleAdminService.getEventStatus(existing));
        const loadedLineup = await eventLineupService.getLineupForAdmin(role, id);
        setLineup(
          loadedLineup.map((entry) => ({
            artistId: entry.artist.id,
            artistName: entry.artist.name,
            artistStatus: entry.artist.status,
            verificationStatus: entry.artist.verificationStatus,
            billingRole: entry.billingRole,
          })),
        );
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, role]);

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
    if (!canEdit) {
      setError('Your role cannot edit events.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextStatus = status ?? record.status;
      if (isContributorReviewEvent(record)) {
        throw new Error('Contributor submissions in review must be moderated through the review workflow.');
      }

      if (nextStatus === 'published' && !canPublish) {
        throw new Error('Your role cannot publish events.');
      }

      if (!isNew && record.id) {
        const existing = await adminEventRepository.getById(record.id);
        if (existing && nextStatus !== existing.status) {
          assertValidAdminEditorialTransition(existing.status, nextStatus);
        }
      }

      const payload = {
        ...record,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      const saved = await adminEventRepository.save(payload);
      if (canEditLineup) {
        await eventLineupService.replaceEventLineup(role, saved.id, lineup);
      }
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

  const isContributorReview = record ? isContributorReviewEvent(record) : false;
  const fieldsEditable = canEdit && !isContributorReview;
  const editableStatuses = isContributorReview
    ? (['review'] as AdminEventStatus[])
    : STATUSES.filter((status) => status !== 'published' || canPublish);

  const remove = async () => {
    if (!record) return;
    if (!canEdit) {
      setError('Your role cannot delete events.');
      return;
    }
    if (isContributorReviewEvent(record)) {
      setError('Contributor submissions in review cannot be deleted outside moderation.');
      return;
    }

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
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{isNew ? 'New Event' : 'Edit Event'}</AppText>
          </View>

          {!isNew ? (
            <View style={styles.lifecycleCard}>
              <AppText style={styles.lifecycleTitle}>Lifecycle</AppText>
              <AppText style={styles.lifecycleMeta}>
                Status: {lifecycleStatus?.lifecycleStatus ?? 'unknown'} · History entries:{' '}
                {lifecycleStatus?.historyCount ?? 0} · Field changes: {lifecycleStatus?.changeCount ?? 0}
              </AppText>
              <AppText style={styles.lifecycleMeta}>
                Last change:{' '}
                {lifecycleStatus?.lastChangeAt
                  ? new Date(lifecycleStatus.lastChangeAt).toLocaleString()
                  : '—'}
                {lifecycleStatus?.lastSourceId ? ` · Source: ${lifecycleStatus.lastSourceId}` : ''}
              </AppText>
              <AppText style={styles.lifecycleMeta}>
                Pending review decisions: {lifecycleStatus?.pendingReviewDecisions ?? 0}
              </AppText>
            </View>
          ) : null}

          {!canEdit ? (
            <AppText style={styles.readOnlyNotice}>
              Your role has view-only access. Event changes are disabled.
            </AppText>
          ) : null}

          <Field label="Title">
            <TextInput
              value={record.title}
              onChangeText={(value) => updateField('title', value)}
              style={styles.input}
              editable={fieldsEditable}
            />
          </Field>
          <Field label="Description">
            <TextInput
              value={record.description}
              onChangeText={(value) => updateField('description', value)}
              multiline
              style={[styles.input, styles.multiline]}
              editable={fieldsEditable}
            />
          </Field>
          <Field label="Start date (ISO)">
            <TextInput
              value={record.startDate}
              onChangeText={(value) => updateField('startDate', value)}
              style={styles.input}
              editable={fieldsEditable}
            />
          </Field>
          <Field label="Ticket URL">
            <TextInput
              value={record.ticketUrl ?? ''}
              onChangeText={(value) => updateField('ticketUrl', value)}
              style={styles.input}
              editable={fieldsEditable}
            />
          </Field>
          <Field label="Image URL">
            <TextInput
              value={record.imageUrl ?? ''}
              onChangeText={(value) => updateField('imageUrl', value)}
              style={styles.input}
              editable={fieldsEditable}
            />
          </Field>

          <AppText style={styles.section}>Genre</AppText>
          <View style={styles.chips}>
            {genreOptions.map((option) => (
              <FilterChip
                key={option.id}
                label={option.label}
                selected={record.genreId === option.id}
                onPress={() => fieldsEditable && updateField('genreId', option.id)}
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
                onPress={() => fieldsEditable && updateField('cityId', option.id)}
              />
            ))}
          </View>

          <VenuePicker
            venues={venueOptions}
            selectedVenueId={record.venueId}
            editable={fieldsEditable}
            onChange={(venueId) => updateField('venueId', venueId)}
          />

          <OrganizerPicker
            organizers={organizerOptions}
            selectedOrganizerId={record.organizerId}
            editable={fieldsEditable}
            onChange={(organizerId) => updateField('organizerId', organizerId)}
          />

          <EventLineupEditor
            lineup={lineup}
            availableArtists={artistOptions}
            editable={fieldsEditable && canEditLineup}
            onChange={setLineup}
          />

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
                onPress={() => fieldsEditable && updateField('status', status)}
              />
            ))}
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          {canEdit ? (
            <PrimaryButton
              label={saving ? 'Saving…' : 'Save'}
              onPress={() => save()}
              disabled={saving || isContributorReview}
            />
          ) : null}
          {canEdit && !isContributorReview ? (
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
          {!isContributorReview && canEdit && canPublish ? (
            <SecondaryButton label="Publish" onPress={() => save('published')} disabled={saving} />
          ) : null}
          {canEdit && !isContributorReview ? (
            <SecondaryButton label="Archive" onPress={() => save('archived')} disabled={saving} />
          ) : null}
          {canEdit && !isNew && !isContributorReview ? (
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
  readOnlyNotice: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
  lifecycleCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  lifecycleTitle: { ...textRoles.metadata, fontWeight: '600' },
  lifecycleMeta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
});
