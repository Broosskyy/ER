import { Text, TextProps, TextStyle } from 'react-native';

import { darkTheme } from '@/design/theme/dark';
import { useThemeOptional, resolveTextRoleStyle } from '@/design/theme';
import type { TextRole } from '@/design/theme';
import { colors } from '@/design/colors';
import { TextVariant, textVariants } from '@/design/typography';

export interface AppTextProps extends Omit<TextProps, 'role'> {
  variant?: TextVariant;
  role?: TextRole;
  color?: string;
  style?: TextStyle;
}

export function AppText({
  variant = 'body',
  role,
  color,
  style,
  children,
  ...rest
}: AppTextProps) {
  const themeContext = useThemeOptional();
  const roleStyle = role
    ? resolveTextRoleStyle(themeContext?.theme ?? darkTheme, role)
    : null;

  return (
    <Text
      style={[
        role ? roleStyle : textVariants[variant],
        color ? { color } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export { colors };
