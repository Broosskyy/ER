import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { layout } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface CreateOptionCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function CreateOptionCard({ title, description, icon, onPress }: CreateOptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.card,
        (pressed || hovered) && styles.pressed,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <AppText style={styles.label}>{title}</AppText>
        <AppText style={styles.description}>{description}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colorRoles.emptyStateDescription} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.9,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  description: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
});
