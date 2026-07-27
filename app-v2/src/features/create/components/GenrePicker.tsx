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
  required?: boolean;
  options: GenrePickerOption[];
  value: string;
  onChange: (genreId: string) => void;
  multiple?: boolean;
  selectedIds?: string[];
  onChangeMultiple?: (genreIds: string[]) => void;
}

export function GenrePicker({
  label,
  helper,
  error,
  required,
  options,
  value,
  onChange,
  multiple = false,
  selectedIds = [],
  onChangeMultiple,
}: GenrePickerProps) {
  const labelText = required ? `${label} *` : label;

  const handlePress = (optionId: string) => {
    if (multiple && onChangeMultiple) {
      const next = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId];
      onChangeMultiple(next);
      return;
    }

    onChange(optionId);
  };

  const isSelected = (optionId: string) =>
    multiple ? selectedIds.includes(optionId) : value === optionId;

  return (
    <View style={styles.container}>
      <AppText style={styles.label}>{labelText}</AppText>
      <View style={styles.chips}>
        {options.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            selected={isSelected(option.id)}
            onPress={() => handlePress(option.id)}
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
