import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';
import {
  ARTIST_BILLING_ROLES,
  type ArtistBillingRole,
} from '@/features/events/domain/artist-billing-role';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { ArtistRecord } from '@/data/types/records';

export interface EventLineupDraftEntry extends EventLineupInput {
  artistName: string;
  artistStatus: ArtistRecord['status'];
  verificationStatus: ArtistRecord['verificationStatus'];
}

interface EventLineupEditorProps {
  lineup: EventLineupDraftEntry[];
  availableArtists: ArtistRecord[];
  editable: boolean;
  onChange: (lineup: EventLineupDraftEntry[]) => void;
}

export function EventLineupEditor({
  lineup,
  availableArtists,
  editable,
  onChange,
}: EventLineupEditorProps) {
  const selectedIds = new Set(lineup.map((entry) => entry.artistId));

  const addArtist = (artist: ArtistRecord) => {
    if (!editable || selectedIds.has(artist.id)) {
      return;
    }

    onChange([
      ...lineup,
      {
        artistId: artist.id,
        artistName: artist.name,
        artistStatus: artist.status,
        verificationStatus: artist.verificationStatus,
        billingRole: lineup.length === 0 ? 'headliner' : 'support',
      },
    ]);
  };

  const removeArtist = (artistId: string) => {
    if (!editable) {
      return;
    }
    onChange(lineup.filter((entry) => entry.artistId !== artistId));
  };

  const updateBillingRole = (artistId: string, billingRole: ArtistBillingRole) => {
    if (!editable) {
      return;
    }
    onChange(
      lineup.map((entry) => (entry.artistId === artistId ? { ...entry, billingRole } : entry)),
    );
  };

  const moveArtist = (artistId: string, direction: -1 | 1) => {
    if (!editable) {
      return;
    }
    const index = lineup.findIndex((entry) => entry.artistId === artistId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= lineup.length) {
      return;
    }
    const next = [...lineup];
    const [moved] = next.splice(index, 1);
    if (!moved) {
      return;
    }
    next.splice(targetIndex, 0, moved);
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <AppText style={styles.section}>Lineup</AppText>
      {lineup.length === 0 ? (
        <AppText style={styles.meta}>No artists selected yet.</AppText>
      ) : (
        lineup.map((entry, index) => (
          <View key={entry.artistId} style={styles.row}>
            <View style={styles.rowHeader}>
              <AppText style={styles.artistName}>
                {index + 1}. {entry.artistName}
              </AppText>
              <AppText style={styles.meta}>
                {entry.artistStatus}
                {entry.verificationStatus === 'verified' ? ' · verified' : ''}
              </AppText>
            </View>
            <View style={styles.chips}>
              {ARTIST_BILLING_ROLES.map((role) => (
                <FilterChip
                  key={role}
                  label={role}
                  selected={entry.billingRole === role}
                  onPress={() => updateBillingRole(entry.artistId, role)}
                />
              ))}
            </View>
            <View style={styles.actions}>
              <SecondaryButton
                label="Up"
                onPress={() => moveArtist(entry.artistId, -1)}
                disabled={!editable || index === 0}
              />
              <SecondaryButton
                label="Down"
                onPress={() => moveArtist(entry.artistId, 1)}
                disabled={!editable || index === lineup.length - 1}
              />
              <SecondaryButton
                label="Remove"
                onPress={() => removeArtist(entry.artistId)}
                disabled={!editable}
              />
            </View>
          </View>
        ))
      )}

      <AppText style={styles.section}>Add artist</AppText>
      <View style={styles.chips}>
        {availableArtists.map((artist) => (
          <FilterChip
            key={artist.id}
            label={selectedIds.has(artist.id) ? `${artist.name} ✓` : artist.name}
            selected={selectedIds.has(artist.id)}
            onPress={() => addArtist(artist)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  section: {
    ...textRoles.sectionTitle,
    marginTop: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  rowHeader: {
    gap: spacing.xs,
  },
  artistName: {
    ...textRoles.cardTitle,
  },
  meta: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textTransform: 'capitalize',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
