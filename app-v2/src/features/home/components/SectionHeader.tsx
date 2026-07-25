import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  isFirst?: boolean;
}

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  isFirst = false,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, isFirst ? styles.containerFirst : null]}>
      <AppText style={styles.title}>{title}</AppText>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText style={styles.action}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacingRoles.sectionTitleGap,
    marginTop: spacingRoles.sectionGap,
  },
  containerFirst: {
    marginTop: spacingRoles.sectionGapFirst,
  },
  title: {
    ...textRoles.sectionTitle,
    flex: 1,
  },
  action: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.8,
  },
});
