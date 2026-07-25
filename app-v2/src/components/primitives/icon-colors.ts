import type { ThemeColors } from '@/design/theme/types';

export type AppIconColorRole =
  | 'default'
  | 'accent'
  | 'muted'
  | 'onAccent'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export function resolveIconColor(colors: ThemeColors, role: AppIconColorRole): string {
  switch (role) {
    case 'accent':
      return colors.accent;
    case 'muted':
      return colors.textSecondary;
    case 'onAccent':
      return colors.textOnAccent;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'destructive':
      return colors.destructive;
    case 'info':
      return colors.info;
    case 'default':
    default:
      return colors.textPrimary;
  }
}
