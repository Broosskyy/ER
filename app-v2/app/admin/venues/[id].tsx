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
import type { VenueRecord } from '@/data/types/records';
import { venueService } from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { canDeleteVenues, canEditVenues } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';

function createEmptyVenue(id: string): VenueRecord {
  const now = new Date().toISOString();
  return {
    id,
    slug: '',
    name: '',
    city: '',
    country: 'Germany',
    createdAt: now,
    updatedAt: now,
  };
}

export default function AdminVenueEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAdminAuth();
  const isNew = id === 'new';
  const canEdit = canEditVenues(role);
  const canDelete = canDeleteVenues(role);
  const [draftVenueId] = useState(() => `venue-${Date.now()}`);
  const [record, setRecord] = useState<VenueRecord | null>(
    isNew ? createEmptyVenue(draftVenueId) : null,
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
        const loaded = await venueService.getByIdForAdmin(role, id);
        if (!loaded) {
          setError('Venue not found.');
          setRecord(null);
        } else {
          setRecord(loaded);
          const eventIds = await venueService.listVenueEvents(role, loaded.id);
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

  const updateField = <K extends keyof VenueRecord>(key: K, value: VenueRecord[K]) => {
    setRecord((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!record || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = isNew
        ? await venueService.create(role, { ...record, id: record.id })
        : await venueService.update(role, record);
      setRecord(saved);
      setSuccess('Venue saved successfully.');
      if (isNew) {
        router.replace(`/admin/venues/${saved.id}` as `/admin/events/${string}`);
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
      await venueService.delete(role, record.id);
      router.replace('/admin/venues' as '/admin/events');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading venue…" />;
  if (error && !record) return <AdminErrorState message={error} onRetry={load} />;
  if (!record) return <AdminErrorState message="Venue not found." onRetry={load} />;

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{isNew ? 'Create Venue' : 'Edit Venue'}</AppText>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          {!isNew ? (
            <AppText style={styles.hint}>
              Editing this venue affects {eventCount} linked event(s).
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

          <AppText style={styles.label}>Street</AppText>
          <TextInput
            style={styles.input}
            value={record.street ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('street', value)}
          />

          <AppText style={styles.label}>House number</AppText>
          <TextInput
            style={styles.input}
            value={record.houseNumber ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('houseNumber', value)}
          />

          <AppText style={styles.label}>Postal code</AppText>
          <TextInput
            style={styles.input}
            value={record.postalCode ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('postalCode', value)}
          />

          <AppText style={styles.label}>City</AppText>
          <TextInput
            style={styles.input}
            value={record.city}
            editable={canEdit}
            onChangeText={(value) => updateField('city', value)}
          />

          <AppText style={styles.label}>State</AppText>
          <TextInput
            style={styles.input}
            value={record.state ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('state', value)}
          />

          <AppText style={styles.label}>Country</AppText>
          <TextInput
            style={styles.input}
            value={record.country}
            editable={canEdit}
            onChangeText={(value) => updateField('country', value)}
          />

          <AppText style={styles.label}>Latitude</AppText>
          <TextInput
            style={styles.input}
            value={record.latitude?.toString() ?? ''}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) =>
              updateField('latitude', value.trim() ? Number(value) : undefined)
            }
          />

          <AppText style={styles.label}>Longitude</AppText>
          <TextInput
            style={styles.input}
            value={record.longitude?.toString() ?? ''}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) =>
              updateField('longitude', value.trim() ? Number(value) : undefined)
            }
          />

          <AppText style={styles.label}>Website</AppText>
          <TextInput
            style={styles.input}
            value={record.website ?? ''}
            editable={canEdit}
            onChangeText={(value) => updateField('website', value)}
          />

          <AppText style={styles.label}>Capacity</AppText>
          <TextInput
            style={styles.input}
            value={record.capacity?.toString() ?? ''}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) =>
              updateField('capacity', value.trim() ? Number(value) : undefined)
            }
          />

          <AppText style={styles.label}>Notes</AppText>
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
