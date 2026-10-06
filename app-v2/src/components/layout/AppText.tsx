import { useContext } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';

import { ThemeContext } from '@/design/theme/ThemeProvider';
import type { AppTextRole } from '@/design/theme/types';
import { TextVariant, textVariants } from '@/design/typography';

export interface AppTextProps extends Omit<TextProps, 'role'> {
  /** Legacy variant — kept for backward compatibility */
  variant?: TextVariant;
  /** Semantic typography role — theme-aware, preferred for new code */
  role?: AppTextRole;
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
  const themeContext = useContext(ThemeContext);

  let baseStyle: TextStyle;

  if (role) {
    if (!themeContext) {
      throw new Error('AppText role prop requires a ThemeProvider ancestor');
    }

    baseStyle = themeContext.theme.typography.textRoles[role];
  } else {
    baseStyle = textVariants[variant];
  }

  return (
    <Text style={[baseStyle, color ? { color } : null, style]} {...rest}>
      {children}
    </Text>
  );
}

export { colors } from '@/design/colors';
