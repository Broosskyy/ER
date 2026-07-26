import { opacity } from '@/design/colors';
import type { Theme } from '@/design/theme/types';

export interface ChipStyleInput {
  selected: boolean;
  disabled: boolean;
}

export interface ResolvedChipStyle {
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  iconColor: string;
  opacity: number;
}

export function resolveChipStyle(
  theme: Theme,
  { selected, disabled }: ChipStyleInput,
): ResolvedChipStyle {
  const { colors, colorRoles } = theme;

  if (selected) {
    return {
      backgroundColor: colorRoles.chipSelectedBackground,
      borderColor: colorRoles.chipSelectedBorder,
      labelColor: colorRoles.chipSelectedText,
      iconColor: colorRoles.chipSelectedText,
      opacity: disabled ? opacity.disabled : 1,
    };
  }

  return {
    backgroundColor: colorRoles.chipBackground,
    borderColor: colorRoles.chipBorder,
    labelColor: colorRoles.chipText,
    iconColor: colors.textSecondary,
    opacity: disabled ? opacity.disabled : 1,
  };
}
