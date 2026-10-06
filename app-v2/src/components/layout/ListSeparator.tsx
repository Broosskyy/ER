import { StyleProp, ViewStyle } from 'react-native';

import { Divider } from '@/components/primitives/Divider';
import type { SpacingToken } from '@/design/spacing';

export interface ListSeparatorProps {
  inset?: SpacingToken;
  orientation?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
}

/**
 * List row separator with optional inset and orientation.
 */
export function ListSeparator({ inset, orientation = 'horizontal', style }: ListSeparatorProps) {
  return <Divider orientation={orientation} inset={inset} style={style} />;
}
