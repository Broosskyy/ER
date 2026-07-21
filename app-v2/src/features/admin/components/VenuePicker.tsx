import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { VenueRecord } from '@/data/types/records';
import { FilterChip } from '@/features/home/components/FilterChip';
import { formatVenuePickerLabel } from '@/features/venues/domain/venue-duplicate';

interface VenuePickerProps {
  venues: VenueRecord[];
  selectedVenueId?: string;
  editable: boolean;
  onChange: (venueId: string | undefined) => void;
}

export function VenuePicker({
  venues,
  selectedVenueId,
  editable,
  onChange,
}: VenuePickerProps) {
  const [query, setQuery] = useState('');

  const filteredVenues = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return venues.slice(0, 12);
    }

    return venues
      .filter((venue) => {
        const haystack = [
          venue.name,
          venue.city,
          venue.country,
          venue.street,
          venue.postalCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 12);
  }, [query, venues]);

  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId);

  return (
    <View style={styles.container}>
      <AppText style={styles.section}>Venue</AppText>
      {selectedVenue ? (
        <View style={styles.selectedCard}>
          {formatVenuePickerLabel(selectedVenue)
            .split('\n')
            .map((line) => (
              <AppText key={line} style={line === selectedVenue.name ? styles.selectedName : styles.meta}>
                {line}
              </AppText>
            ))}
          {editable ? (
            <SecondaryButton label="Clear venue" onPress={() => onChange(undefined)} />
          ) : null}
        </View>
      ) : (
        <AppText style={styles.meta}>No canonical venue selected.</AppText>
      )}

      {editable ? (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search venues by name, city, or address…"
            placeholderTextColor={colorRoles.emptyStateDescription}
            style={styles.search}
          />
          <View style={styles.chips}>
            {filteredVenues.map((venue) => (
              <FilterChip
                key={venue.id}
                label={`${venue.name} · ${venue.city}`}
                selected={venue.id === selectedVenueId}
                onPress={() => onChange(venue.id)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  section: { ...textRoles.sectionTitle, marginTop: spacing.sm },
  selectedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  selectedName: { ...textRoles.cardTitle },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
