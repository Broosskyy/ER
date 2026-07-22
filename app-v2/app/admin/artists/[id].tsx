import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { ArtistRecord } from '@/data/types/records';
import { artistService, genreRepository } from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import {
  canArchiveArtists,
  canEditArtists,
  canPublishArtists,
  canVerifyArtists,
} from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { FilterChip } from '@/features/home/components/FilterChip';
import type {
  ArtistLifecycleStatus,
  ArtistVerificationStatus,
} from '@/features/artists/types/artist-status';

const LIFECYCLE_STATUSES: ArtistLifecycleStatus[] = ['draft', 'published', 'archived'];
const VERIFICATION_STATUSES: ArtistVerificationStatus[] = ['unverified', 'verified'];

function createEmptyArtist(id: string): ArtistRecord {
  const now = new Date().toISOString();
  return {
    id,
    name: '',
    slug: '',
    genreIds: [],
    status: 'draft',
    verificationStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
  };
}

export default function AdminArtistEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAdminAuth();
  const isNew = id === 'new';
  const canEdit = canEditArtists(role);
  const canPublish = canPublishArtists(role);
  const canArchive = canArchiveArtists(role);
  const canVerify = canVerifyArtists(role);
  const [draftArtistId] = useState(() => `artist-${Date.now()}`);
  const [record, setRecord] = useState<ArtistRecord | null>(
    isNew ? createEmptyArtist(draftArtistId) : null,
  );
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [genreOptions, setGenreOptions] = useState<{ id: string; label: string }[]>([]);
  const draftArtistIdRef = useRef(draftArtistId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const genres = await genreRepository.getActive();
      setGenreOptions(genres.map((genre) => ({ id: genre.id, label: genre.name })));

      if (!isNew) {
        const loaded = await artistService.getByIdForAdmin(role, id);
        if (!loaded) {
          setError('Artist not found.');
          setRecord(null);
        } else {
          setRecord(loaded);
        }
      } else {
        setRecord(createEmptyArtist(draftArtistIdRef.current));
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

  const updateRecord = (patch: Partial<ArtistRecord>) => {
    setRecord((current) => (current ? { ...current, ...patch } : current));
  };

  const toggleGenre = (genreId: string) => {
    setRecord((current) => {
      if (!current) return current;
      const genreIds = current.genreIds.includes(genreId)
        ? current.genreIds.filter((item) => item !== genreId)
        : [...current.genreIds, genreId];
      return { ...current, genreIds };
    });
  };

  const handleSave = async (nextStatus?: ArtistLifecycleStatus) => {
    if (!record || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        ...record,
        status: nextStatus ?? record.status,
      };
      const saved = isNew
        ? await artistService.create(role, { ...payload, id: draftArtistIdRef.current })
        : await artistService.update(role, payload);
      setRecord(saved);
      setSuccess('Artist saved.');
      if (isNew) {
        router.replace(`/admin/artists/${saved.id}` as `/admin/events/${string}`);
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!record || !canArchive) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await artistService.archive(role, record.id);
      setRecord(saved);
      setSuccess('Artist archived.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading artist…" />;
  if (!record) {
    return <AdminErrorState message={error ?? 'Artist not found.'} onRetry={load} />;
  }

  const readOnly = !canEdit;

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{isNew ? 'New Artist' : record.name}</AppText>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          <AppText style={styles.label}>Name</AppText>
          <TextInput
            style={styles.input}
            value={record.name}
            onChangeText={(name) => updateRecord({ name })}
            editable={!readOnly}
          />

          <AppText style={styles.label}>Slug</AppText>
          <TextInput
            style={styles.input}
            value={record.slug}
            onChangeText={(slug) => updateRecord({ slug })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Bio</AppText>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={record.bio ?? ''}
            onChangeText={(bio) => updateRecord({ bio })}
            editable={!readOnly}
            multiline
          />

          <AppText style={styles.label}>Image URL</AppText>
          <TextInput
            style={styles.input}
            value={record.imageUrl ?? ''}
            onChangeText={(imageUrl) => updateRecord({ imageUrl })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Country</AppText>
          <TextInput
            style={styles.input}
            value={record.country ?? ''}
            onChangeText={(country) => updateRecord({ country })}
            editable={!readOnly}
          />

          <AppText style={styles.label}>City</AppText>
          <TextInput
            style={styles.input}
            value={record.city ?? ''}
            onChangeText={(city) => updateRecord({ city })}
            editable={!readOnly}
          />

          <AppText style={styles.label}>Genres</AppText>
          <View style={styles.chips}>
            {genreOptions.map((genre) => (
              <FilterChip
                key={genre.id}
                label={genre.label}
                selected={record.genreIds.includes(genre.id)}
                onPress={() => {
                  if (!readOnly) toggleGenre(genre.id);
                }}
              />
            ))}
          </View>

          <AppText style={styles.label}>Website</AppText>
          <TextInput
            style={styles.input}
            value={record.website ?? ''}
            onChangeText={(website) => updateRecord({ website })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Instagram</AppText>
          <TextInput
            style={styles.input}
            value={record.instagram ?? ''}
            onChangeText={(instagram) => updateRecord({ instagram })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Facebook</AppText>
          <TextInput
            style={styles.input}
            value={record.facebook ?? ''}
            onChangeText={(facebook) => updateRecord({ facebook })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>SoundCloud</AppText>
          <TextInput
            style={styles.input}
            value={record.soundcloud ?? ''}
            onChangeText={(soundcloud) => updateRecord({ soundcloud })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Spotify</AppText>
          <TextInput
            style={styles.input}
            value={record.spotify ?? ''}
            onChangeText={(spotify) => updateRecord({ spotify })}
            editable={!readOnly}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Lifecycle status</AppText>
          <View style={styles.chips}>
            {LIFECYCLE_STATUSES.map((status) => (
              <FilterChip
                key={status}
                label={status}
                selected={record.status === status}
                onPress={() => {
                  if (!readOnly && (status !== 'published' || canPublish) && (status !== 'archived' || canArchive)) {
                    updateRecord({ status });
                  }
                }}
              />
            ))}
          </View>

          <AppText style={styles.label}>Verification</AppText>
          <View style={styles.chips}>
            {VERIFICATION_STATUSES.map((verificationStatus) => (
              <FilterChip
                key={verificationStatus}
                label={verificationStatus}
                selected={record.verificationStatus === verificationStatus}
                onPress={() => {
                  if (!readOnly && canVerify) {
                    updateRecord({ verificationStatus });
                  }
                }}
              />
            ))}
          </View>

          <View style={styles.actions}>
            {canEdit ? (
              <PrimaryButton
                label={saving ? 'Saving…' : 'Save'}
                onPress={() => void handleSave()}
                disabled={saving}
              />
            ) : null}
            {canEdit && canPublish && record.status !== 'published' ? (
              <SecondaryButton
                label="Publish"
                onPress={() => void handleSave('published')}
                disabled={saving}
              />
            ) : null}
            {canArchive && record.status !== 'archived' && !isNew ? (
              <SecondaryButton
                label="Archive"
                onPress={() => void handleArchive()}
                disabled={saving}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacingRoles.screenHorizontal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...textRoles.sectionTitle,
    flex: 1,
  },
  label: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
  success: {
    ...textRoles.metadata,
    color: colors.success,
  },
});
