import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { VenueRecord } from '@/data/types/records';
import { FormField } from '@/features/create/components/FormField';

export interface VenueAutocompleteProps {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  venues: VenueRecord[];
  venueId: string;
  venueText: string;
  onVenueIdChange: (venueId: string) => void;
  onVenueTextChange: (venueText: string) => void;
  placeholder: string;
  freeTextHint: string;
}

export function VenueAutocomplete({
  label,
  helper,
  error,
  required,
  venues,
  venueId,
  venueText,
  onVenueIdChange,
  onVenueTextChange,
  placeholder,
  freeTextHint,
}: VenueAutocompleteProps) {
  const [focused, setFocused] = useState(false);
  const selectedVenue = venues.find((venue) => venue.id === venueId);
  const displayValue = selectedVenue?.name ?? venueText;

  const suggestions = useMemo(() => {
    const query = displayValue.trim().toLowerCase();
    if (!query) {
      return venues.slice(0, 6);
    }

    return venues
      .filter((venue) => venue.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [displayValue, venues]);

  const showSuggestions = focused && suggestions.length > 0;

  const handleChangeText = (value: string) => {
    onVenueTextChange(value);
    onVenueIdChange('');
  };

  const handleSelectVenue = (venue: VenueRecord) => {
    onVenueIdChange(venue.id);
    onVenueTextChange(venue.name);
    setFocused(false);
  };

  return (
    <FormField label={label} helper={helper} error={error} required={required}>
      <TextInput
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 120);
        }}
        placeholder={placeholder}
        placeholderTextColor={colorRoles.emptyStateDescription}
        style={styles.input}
        accessibilityLabel={label}
      />
      {showSuggestions ? (
        <View style={styles.suggestions}>
          {suggestions.map((venue) => (
            <Pressable
              key={venue.id}
              accessibilityRole="button"
              onPress={() => handleSelectVenue(venue)}
              style={({ pressed, hovered }) => [
                styles.suggestion,
                (pressed || hovered) && styles.suggestionPressed,
              ]}
            >
              <AppText style={styles.suggestionText}>{venue.name}</AppText>
              <AppText style={styles.suggestionMeta}>
                {[venue.city, venue.country].filter(Boolean).join(', ')}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!venueId && venueText.trim() ? (
        <AppText style={styles.freeTextHint}>{freeTextHint}</AppText>
      ) : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    fontSize: textRoles.body.fontSize,
    lineHeight: textRoles.body.lineHeight,
    color: colors.textPrimary,
  },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  suggestionPressed: {
    backgroundColor: colors.surface,
  },
  suggestionText: {
    ...textRoles.body,
    color: colors.textPrimary,
  },
  suggestionMeta: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  freeTextHint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
});
