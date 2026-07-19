import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface CollectionHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  onFilterPress?: () => void;
  showFilter?: boolean;
}

export function CollectionHeader({
  title,
  subtitle,
  count,
  onFilterPress,
  showFilter = false,
}: CollectionHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <IconButton
          icon="arrow-back"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        />
        {showFilter && onFilterPress ? (
          <IconButton icon="options-outline" accessibilityLabel="Filters" onPress={onFilterPress} />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
      <AppText style={styles.title}>{title}</AppText>
      {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
      {typeof count === 'number' ? (
        <AppText style={styles.count}>
          {count} {count === 1 ? 'event' : 'events'}
        </AppText>
      ) : null}
    </View>
  );
}

export function CollectionUnknownState() {
  const router = useRouter();

  return (
    <View style={styles.unknownContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={colorRoles.emptyStateIcon} />
      <AppText style={styles.unknownTitle}>Collection not found</AppText>
      <AppText style={styles.unknownDescription}>
        This event collection is not available.
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
      >
        <AppText style={styles.backLinkText}>Go back</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  spacer: {
    width: 44,
  },
  title: {
    ...textRoles.screenTitle,
  },
  subtitle: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  count: {
    ...textRoles.badge,
    color: colorRoles.emptyStateDescription,
    marginTop: spacing.xs,
  },
  unknownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.sm,
  },
  unknownTitle: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
  },
  unknownDescription: {
    ...textRoles.metadata,
    textAlign: 'center',
    color: colorRoles.emptyStateDescription,
  },
  backLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backLinkText: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
