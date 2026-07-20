import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';

export interface GenrePickerOption {
  id: string;
  label: string;
}

export interface GenrePickerProps {
  label: string;
  helper?: string;
  error?: string;
  options: GenrePickerOption[];
  value: string;
  onChange: (genreId: string) => void;
}

export function GenrePicker({ label, helper, error, options, value, onChange }: GenrePickerProps) {
  return (
    <View style={styles.container}>
      <AppText style={styles.label}>{label}</AppText>
      <View style={styles.chips}>
        {options.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            selected={value === option.id}
            onPress={() => onChange(option.id)}
          />
        ))}
      </View>
      {helper ? <AppText style={styles.helper}>{helper}</AppText> : null}
      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  helper: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
});
