import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <AppText style={selected ? styles.labelSelected : styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: componentSize.chipHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radiusRoles.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorRoles.chipBackground,
    borderWidth: 1,
    borderColor: colorRoles.chipBorder,
  },
  chipSelected: {
    backgroundColor: colorRoles.chipSelectedBackground,
    borderColor: colorRoles.chipSelectedBorder,
  },
  pressed: {
    backgroundColor: colors.surfaceSubtle,
  },
  label: {
    ...textRoles.chip,
  },
  labelSelected: {
    ...textRoles.chipSelected,
  },
});
