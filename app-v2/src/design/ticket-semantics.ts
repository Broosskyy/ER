import type { ThemeColors } from '@/design/theme/types';

/** Semantic ticket/availability color tokens shared across discovery and detail surfaces. */
export type SemanticColorToken = 'accent' | 'success' | 'unavailable' | 'muted';

/** Maps semantic ticket tokens to theme colors — components must import from here, not features. */
export function resolveSemanticThemeColor(colors: ThemeColors, token: SemanticColorToken): string {
  switch (token) {
    case 'success':
      return colors.success;
    case 'accent':
      return colors.accent;
    case 'unavailable':
      return colors.textMuted;
    case 'muted':
    default:
      return colors.textMuted;
  }
}
