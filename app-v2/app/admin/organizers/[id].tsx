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
import type { OrganizerRecord } from '@/data/types/records';
import { organizerService } from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canDeleteOrganizers, canEditOrganizers } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';

function createEmptyOrganizer(id: string): OrganizerRecord {
  const now = new Date().toISOString();
  return {
    id,
    slug: '',
    name: '',
    createdAt: now,
    updatedAt: now,
  };
}

export default function AdminOrganizerEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAdminAuth();
  const isNew = id === 'new';
  const canEdit = canEditOrganizers(role);
  const canDelete = canDeleteOrganizers(role);
  const [draftOrganizerId] = useState(() => `organizer-${Date.now()}`);
  const [record, setRecord] = useState<OrganizerRecord | null>(
    isNew ? createEmptyOrganizer(draftOrganizerId) : null,
  );
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isNew) {
        const loaded = await organizerService.getByIdForAdmin(role, id);
        if (!loaded) {
          setError('Organizer not found.');
          setRecord(null);
        } else {
          setRecord(loaded);
          const eventIds = await organizerService.listOrganizerEvents(role, loaded.id);
          setEventCount(eventIds.length);
        }
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

  const updateField = <K extends keyof OrganizerRecord>(key: K, value: OrganizerRecord[K]) => {
    setRecord((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!record || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = isNew
        ? await organizerService.create(role, { ...record, id: record.id })
        : await organizerService.update(role, record);
      setRecord(saved);
      setSuccess('Organizer saved successfully.');
      if (isNew) {
        router.replace(`/admin/organizers/${saved.id}` as `/admin/events/${string}`);
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!record || !canDelete || isNew) return;
    setSaving(true);
    setError(null);
    try {
      await organizerService.delete(role, record.id);
      router.replace('/admin/organizers' as '/admin/events');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading organizer…" />;
  if (error && !record) return <AdminErrorState message={error} onRetry={load} />;
  if (!record) return <AdminErrorState message="Organizer not found." onRetry={load} />;

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{isNew ? 'Create Organizer' : 'Edit Organizer'}</AppText>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          {!isNew ? (
            <AppText style={styles.hint}>
              Editing this organizer affects {eventCount} linked event(s).
            </AppText>
          ) : null}

          <AppText style={styles.label}>Name</AppText>
          <TextInput
            style={styles.input}
            value={record.name}
            editable={canEdit}
            onChangeText={(value) => updateField('name', value)}
          />

          <AppText style={styles.label}>Slug</AppText>
          <TextInput
            style={styles.input}
            value={record.slug}
            editable={canEdit && !isNew}
            onChangeText={(value) => updateField('slug', value)}
            placeholder="Generated on create"
            placeholderTextColor={colorRoles.emptyStateDescription}
          />

          <AppText style={styles.label}>Description</AppText>
          <TextInput
            style={[styles.input, styles.notes]}
            value={record.description ?? ''}
            editable={canEdit}
            multiline
            onChangeText={(value) => updateField('description', value)}
          />

          <AppText style={styles.label}>Website</AppText>
          <TextInput
            style={styles.input}
            value={record.website ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('website', value)}
          />

          <AppText style={styles.label}>Email</AppText>
          <TextInput
            style={styles.input}
            value={record.email ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('email', value)}
          />

          <AppText style={styles.label}>Phone</AppText>
          <TextInput
            style={styles.input}
            value={record.phone ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('phone', value)}
          />

          <AppText style={styles.label}>Instagram</AppText>
          <TextInput
            style={styles.input}
            value={record.instagram ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('instagram', value)}
          />

          <AppText style={styles.label}>Facebook</AppText>
          <TextInput
            style={styles.input}
            value={record.facebook ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('facebook', value)}
          />

          <AppText style={styles.label}>SoundCloud</AppText>
          <TextInput
            style={styles.input}
            value={record.soundcloud ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('soundcloud', value)}
          />

          <AppText style={styles.label}>Resident Advisor</AppText>
          <TextInput
            style={styles.input}
            value={record.residentAdvisor ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('residentAdvisor', value)}
          />

          <AppText style={styles.label}>Logo URL</AppText>
          <TextInput
            style={styles.input}
            value={record.logoUrl ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('logoUrl', value)}
          />

          <AppText style={styles.label}>City</AppText>
          <TextInput
            style={styles.input}
            value={record.city ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('city', value)}
          />

          <AppText style={styles.label}>Country</AppText>
          <TextInput
            style={styles.input}
            value={record.country ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('country', value)}
          />

          <AppText style={styles.sectionLabel}>Internal notes</AppText>
          <TextInput
            style={[styles.input, styles.notes]}
            value={record.notes ?? ''}
            editable={canEdit}
            multiline
            onChangeText={(value) => updateField('notes', value)}
          />

          <View style={styles.actions}>
            {canEdit ? (
              <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
            ) : null}
            {canDelete && !isNew ? (
              <SecondaryButton label="Delete" onPress={handleDelete} disabled={saving} />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { ...textRoles.screenTitle, flex: 1 },
  label: { ...textRoles.sectionTitle, marginTop: spacing.sm },
  sectionLabel: { ...textRoles.sectionTitle, marginTop: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  hint: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  error: { ...textRoles.body, color: colors.live },
  success: { ...textRoles.body, color: colors.success },
});
