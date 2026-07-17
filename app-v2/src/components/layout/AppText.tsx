import { Text, TextProps, TextStyle } from 'react-native';

import { colors } from '@/design/colors';
import { TextVariant, textVariants } from '@/design/typography';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  style?: TextStyle;
}

export function AppText({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text style={[textVariants[variant], color ? { color } : null, style]} {...rest}>
      {children}
    </Text>
  );
}

export { colors };
