import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

export interface EventMetaRowProps {
  icon: AppIconName;
  label: string;
  value: string;
  secondaryValue?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Mockup 11 metadata row with an optional press action. */
export function EventMetaRow({
  icon,
  label,
  value,
  secondaryValue,
  onPress,
  style,
}: EventMetaRowProps) {
  const { theme } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      <AppIcon name={icon} size="sm" colorRole="accent" />
      <AppText role="metadata" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.valueArea}>
        <AppText role="body" style={styles.value} numberOfLines={1}>
          {value}
        </AppText>
        {secondaryValue ? (
          <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>
            {secondaryValue}
          </AppText>
        ) : null}
      </View>
      {onPress ? <AppIcon name="chevron-forward" size="sm" colorRole="muted" /> : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    minWidth: 0,
  },
  valueArea: {
    flex: 1,
    alignItems: 'flex-end',
    gap: spacing.xs,
    minWidth: 0,
  },
  value: {
    textAlign: 'right',
  },
});
