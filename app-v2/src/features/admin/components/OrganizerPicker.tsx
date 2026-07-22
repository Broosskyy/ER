import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { OrganizerRecord } from '@/data/types/records';
import { FilterChip } from '@/features/home/components/FilterChip';
import { formatOrganizerPickerLabel } from '@/features/organizers/domain/organizer-duplicate';

interface OrganizerPickerProps {
  organizers: OrganizerRecord[];
  selectedOrganizerId?: string;
  editable: boolean;
  onChange: (organizerId: string | undefined) => void;
}

export function OrganizerPicker({
  organizers,
  selectedOrganizerId,
  editable,
  onChange,
}: OrganizerPickerProps) {
  const [query, setQuery] = useState('');

  const filteredOrganizers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return organizers.slice(0, 12);
    }

    return organizers
      .filter((organizer) => {
        const haystack = [
          organizer.name,
          organizer.city,
          organizer.country,
          organizer.website,
          organizer.instagram,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 12);
  }, [organizers, query]);

  const selectedOrganizer = organizers.find((organizer) => organizer.id === selectedOrganizerId);

  return (
    <View style={styles.container}>
      <AppText style={styles.section}>Organizer</AppText>
      {selectedOrganizer ? (
        <View style={styles.selectedCard}>
          {formatOrganizerPickerLabel(selectedOrganizer)
            .split('\n')
            .map((line) => (
              <AppText
                key={line}
                style={line === selectedOrganizer.name ? styles.selectedName : styles.meta}
              >
                {line}
              </AppText>
            ))}
          {editable ? (
            <SecondaryButton label="Clear organizer" onPress={() => onChange(undefined)} />
          ) : null}
        </View>
      ) : (
        <AppText style={styles.meta}>No canonical organizer selected.</AppText>
      )}

      {editable ? (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search organizers by name, city, or website…"
            placeholderTextColor={colorRoles.emptyStateDescription}
            style={styles.search}
          />
          <View style={styles.chips}>
            {filteredOrganizers.map((organizer) => (
              <FilterChip
                key={organizer.id}
                label={`${organizer.name}${organizer.city ? ` · ${organizer.city}` : ''}`}
                selected={organizer.id === selectedOrganizerId}
                onPress={() => onChange(organizer.id)}
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
