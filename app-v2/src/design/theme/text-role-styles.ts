import type { TextStyle } from 'react-native';

import type { EternalRaveTheme, TextRole } from './types';

export function resolveTextRoleStyle(
  theme: EternalRaveTheme,
  role: TextRole,
): TextStyle {
  const style = theme.typography.roles[role];

  if (!style) {
    throw new Error(`Unknown text role: ${role}`);
  }

  return style;
}
