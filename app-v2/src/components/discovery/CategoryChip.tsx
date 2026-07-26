import { PressableProps, ViewStyle } from 'react-native';

import { AppIconName } from '@/components/primitives/AppIcon';

import { DiscoveryChip } from './DiscoveryChip';

export interface CategoryChipProps extends Omit<PressableProps, 'style'> {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: AppIconName;
  count?: number;
  style?: ViewStyle;
}

/** Genre and discovery category selector based on Mockup 55. */
export function CategoryChip(props: CategoryChipProps) {
  return <DiscoveryChip {...props} />;
}
