import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { TextButton } from '@/components/buttons/TextButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { Badge } from '@/components/feedback/Badge';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { resolveSuggestionIcon } from './search-styles';
import type {
  RecentSearchViewModel,
  SearchSuggestionViewModel,
  TrendingSearchViewModel,
} from './view-models';

export interface SearchSuggestionItemProps {
  suggestion: SearchSuggestionViewModel;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function SearchSuggestionItem({
  suggestion,
  onPress,
  style,
  testID,
}: SearchSuggestionItemProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" onPress={onPress} style={style} testID={testID}>
      <View style={styles.row}>
        <AppIcon
          name={resolveSuggestionIcon(suggestion.kind)}
          size="md"
          color={theme.colors.accent}
        />
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <AppText role="bodyStrong" numberOfLines={1}>
              {suggestion.title}
            </AppText>
            {suggestion.badgeLabel ? (
              <Badge label={suggestion.badgeLabel} status="info" />
            ) : null}
          </View>
          {suggestion.subtitleLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>
              {suggestion.subtitleLabel}
            </AppText>
          ) : null}
        </View>
        <AppIcon name="arrow-forward" size="sm" colorRole="muted" />
      </View>
    </CardFoundation>
  );
}

export interface RecentSearchItemProps {
  item: RecentSearchViewModel;
  onPress?: () => void;
  onRemove?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function RecentSearchItem({
  item,
  onPress,
  onRemove,
  style,
  testID,
}: RecentSearchItemProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.recentRow, style]} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.recentMain, pressed && styles.pressed]}
      >
        <AppIcon name="time-outline" size="md" colorRole="muted" />
        <View style={styles.copy}>
          <AppText role="bodyStrong" numberOfLines={1}>
            {item.title}
          </AppText>
          {item.subtitleLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>
              {item.subtitleLabel}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title} entfernen`}
          onPress={onRemove}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.removeAction, pressed && styles.pressed]}
        >
          <AppIcon name="close" size="sm" colorRole="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

export interface TrendingSearchItemProps {
  item: TrendingSearchViewModel;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function TrendingSearchItem({
  item,
  onPress,
  style,
  testID,
}: TrendingSearchItemProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" onPress={onPress} style={style} testID={testID}>
      <View style={styles.row}>
        {item.rank !== undefined ? (
          <AppText role="label" color={theme.colors.accent}>
            {item.rank}
          </AppText>
        ) : (
          <AppIcon name="trending-up" size="md" color={theme.colors.accent} />
        )}
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <AppText role="bodyStrong" numberOfLines={1}>
              {item.title}
            </AppText>
            {item.badgeLabel ? <Badge label={item.badgeLabel} status="info" /> : null}
          </View>
          {item.trendLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>
              {item.trendLabel}
            </AppText>
          ) : null}
        </View>
      </View>
    </CardFoundation>
  );
}

export interface SearchSectionHeaderProps {
  title: string;
  count?: number;
  action?: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function SearchSectionHeader({
  title,
  count,
  action,
  actionLabel,
  onActionPress,
  style,
  testID,
}: SearchSectionHeaderProps) {
  const { theme } = useTheme();
  const resolvedAction =
    action ??
    (actionLabel && onActionPress ? (
      <TextButton label={actionLabel} onPress={onActionPress} />
    ) : null);

  return (
    <View style={[styles.headerRow, style]} testID={testID}>
      <View style={styles.headerCopy}>
        <AppText role="titleSmall">{title}</AppText>
        {count !== undefined ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            {count}
          </AppText>
        ) : null}
      </View>
      {resolvedAction}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  removeAction: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
  },
});
