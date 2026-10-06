import { PressableProps, ViewStyle } from 'react-native';

import { AppIconName } from '@/components/primitives/AppIcon';

import { DiscoveryChip } from './DiscoveryChip';

export interface FilterChipProps extends Omit<PressableProps, 'style'> {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  removable?: boolean;
  icon?: AppIconName;
  count?: number;
  onRemove?: () => void;
  style?: ViewStyle;
}

/** Active/inactive filter chip with optional count and removal affordance. */
export function FilterChip(props: FilterChipProps) {
  return <DiscoveryChip {...props} />;
}
