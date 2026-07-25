import { Ionicons } from '@expo/vector-icons';
import { StyleProp, TextStyle, View, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';

import { resolveIconColor, type AppIconColorRole } from './icon-colors';
import { resolveIconSize, type AppIconSize } from './icon-sizes';

export type { AppIconSize };

export type AppIconName = keyof typeof Ionicons.glyphMap;

export interface AppIconProps {
  name: AppIconName;
  size?: AppIconSize;
  colorRole?: AppIconColorRole;
  /** Overrides semantic color role when needed */
  color?: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Theme-aware icon wrapper around Ionicons.
 * Sizes and colors map to design tokens — ready for a future icon library swap.
 */
export function AppIcon({
  name,
  size = 'md',
  colorRole = 'default',
  color,
  style,
  containerStyle,
  accessibilityLabel,
}: AppIconProps) {
  const { theme } = useTheme();
  const resolvedSize = resolveIconSize(size);
  const resolvedColor = color ?? resolveIconColor(theme.colors, colorRole);

  return (
    <View style={containerStyle} accessibilityLabel={accessibilityLabel}>
      <Ionicons name={name} size={resolvedSize} color={resolvedColor} style={style} />
    </View>
  );
}
