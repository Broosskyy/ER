import { Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { componentSize } from '@/design/layout';

export interface FavoriteButtonProps {
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function FavoriteButton({
  active,
  onPress,
  accessibilityLabel = 'Toggle favorite',
}: FavoriteButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      hitSlop={12}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <AppIcon
        name={active ? 'heart' : 'heart-outline'}
        size="md"
        color={active ? theme.colors.accent : theme.colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: componentSize.iconButtonSize,
    height: componentSize.iconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
