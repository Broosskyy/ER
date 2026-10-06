import { componentSize } from '@/design/layout';

export const iconSizes = {
  sm: componentSize.iconSm,
  md: componentSize.iconMd,
  lg: componentSize.iconLg,
} as const;

export type AppIconSize = keyof typeof iconSizes;

export function resolveIconSize(size: AppIconSize): number {
  return iconSizes[size];
}
