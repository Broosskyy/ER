import { StyleSheet, View, ViewStyle } from 'react-native';

import { TextButton } from '@/components/buttons/TextButton';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { SavedSectionViewModel } from './view-models';

export interface SavedSectionHeaderProps {
  section: SavedSectionViewModel;
  onSortPress?: () => void;
  onFilterPress?: () => void;
  onEditPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 14 saved list header with count and sort action. */
export function SavedSectionHeader({
  section,
  onSortPress,
  onFilterPress,
  onEditPress,
  style,
  testID,
}: SavedSectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, style]} testID={testID}>
      <View style={styles.copy}>
        <AppIcon name="bookmark" size="sm" color={theme.colors.accent} />
        <AppText role="titleSmall">{section.title}</AppText>
        {section.count !== undefined ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            {section.count}
          </AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onFilterPress && section.filterLabel ? (
          <TextButton label={section.filterLabel} onPress={onFilterPress} />
        ) : null}
        {onSortPress && section.sortLabel ? (
          <TextButton label={section.sortLabel} onPress={onSortPress} />
        ) : null}
        {onEditPress && section.editing !== undefined ? (
          <TextButton label={section.editing ? 'Fertig' : 'Bearbeiten'} onPress={onEditPress} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
