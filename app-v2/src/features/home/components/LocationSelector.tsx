import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export function LocationSelector() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change location"
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <Ionicons name="location" size={componentSize.iconSm} color={colors.primary} />
      <AppText style={styles.label}>Berlin, Germany</AppText>
      <Ionicons name="chevron-down" size={componentSize.iconSm} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    minHeight: componentSize.chipHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radiusRoles.chip,
    backgroundColor: colorRoles.chipBackground,
    borderWidth: 1,
    borderColor: colorRoles.chipBorder,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    ...textRoles.cardSubtitle,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
