import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colorRoles } from '@/design/colors';
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
      <Ionicons
        name={active ? 'heart' : 'heart-outline'}
        size={componentSize.iconMd}
        color={active ? colorRoles.favoriteActive : colorRoles.favoriteInactive}
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
