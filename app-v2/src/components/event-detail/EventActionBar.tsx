import { StyleSheet, View, ViewStyle } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { IconButton } from '@/components/buttons/IconButton';
import type { AppIconName } from '@/components/primitives/AppIcon';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface EventActionBarProps {
  saved?: boolean;
  onSavePress?: () => void;
  onSharePress?: () => void;
  onCalendarPress?: () => void;
  onDirectionsPress?: () => void;
  onMorePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

type ActionConfig = {
  key: string;
  label: string;
  icon: AppIconName;
  onPress: () => void;
  active?: boolean;
};

/** Mockup-belegte Event-Aktionen als flache Icon-Buttons — keine verschachtelten Pressables. */
export function EventActionBar({
  saved = false,
  onSavePress,
  onSharePress,
  onCalendarPress,
  onDirectionsPress,
  onMorePress,
  style,
  testID,
}: EventActionBarProps) {
  const { theme } = useTheme();

  const actions: ActionConfig[] = [];
  if (onSavePress) {
    actions.push({ key: 'save', label: 'Speichern', icon: 'heart-outline', onPress: onSavePress, active: saved });
  }
  if (onSharePress) {
    actions.push({ key: 'share', label: 'Teilen', icon: 'share-outline', onPress: onSharePress });
  }
  if (onCalendarPress) {
    actions.push({ key: 'calendar', label: 'Kalender', icon: 'calendar-outline', onPress: onCalendarPress });
  }
  if (onDirectionsPress) {
    actions.push({ key: 'directions', label: 'Route', icon: 'navigate-outline', onPress: onDirectionsPress });
  }
  if (onMorePress) {
    actions.push({ key: 'more', label: 'Mehr', icon: 'ellipsis-horizontal', onPress: onMorePress });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.bar, { borderColor: theme.colors.borderSubtle }, style]} testID={testID}>
      {actions.map((action) => (
        <View key={action.key} style={styles.action}>
          {action.key === 'save' ? (
            <FavoriteButton
              active={Boolean(action.active)}
              onPress={action.onPress}
              accessibilityLabel={action.active ? 'Aus Gespeichert entfernen' : 'Event speichern'}
            />
          ) : (
            <IconButton icon={action.icon} accessibilityLabel={action.label} onPress={action.onPress} />
          )}
          <AppText role="caption" color={theme.colors.textSecondary}>
            {action.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  action: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 64,
  },
});
