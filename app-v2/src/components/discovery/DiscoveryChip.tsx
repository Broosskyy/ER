import { Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';

import { resolveChipStyle } from './chip-styles';

interface DiscoveryChipProps extends Omit<PressableProps, 'style'> {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: AppIconName;
  count?: number;
  removable?: boolean;
  onRemove?: () => void;
  style?: ViewStyle;
}

/** Internal token-based chip base used by category and filter chips. */
export function DiscoveryChip({
  label,
  selected = false,
  disabled = false,
  icon,
  count,
  removable = false,
  onRemove,
  style,
  ...rest
}: DiscoveryChipProps) {
  const { theme } = useTheme();
  const resolved = resolveChipStyle(theme, { selected, disabled });

  const mainAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: resolved.backgroundColor,
          borderColor: resolved.borderColor,
          opacity: pressed && !disabled ? 0.88 : resolved.opacity,
        },
        style,
      ]}
      {...rest}
    >
      {selected ? <AppIcon name="checkmark" size="sm" color={resolved.iconColor} /> : null}
      {icon ? <AppIcon name={icon} size="sm" color={resolved.iconColor} /> : null}
      <AppText role={selected ? 'chipSelected' : 'chip'} color={resolved.labelColor}>
        {label}
      </AppText>
      {count !== undefined ? (
        <AppText role={selected ? 'chipSelected' : 'chip'} color={resolved.labelColor}>
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );

  if (!removable) {
    return mainAction;
  }

  return (
    <View style={styles.removableWrapper}>
      {mainAction}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        disabled={disabled}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.removeAction, pressed && styles.removePressed]}
      >
        <AppIcon name="close" size="sm" color={resolved.iconColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: componentSize.chipHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radiusRoles.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  removableWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusRoles.chip,
    overflow: 'hidden',
  },
  removeAction: {
    minHeight: componentSize.chipHeight,
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  removePressed: {
    opacity: 0.88,
  },
});
