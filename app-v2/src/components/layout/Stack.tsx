import { ReactNode } from 'react';
import { FlexAlignType, StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';
import type { SpacingToken } from '@/design/spacing';

export type StackDirection = 'vertical' | 'horizontal';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between';

export interface StackProps {
  children: ReactNode;
  direction?: StackDirection;
  gap?: SpacingToken;
  align?: StackAlign;
  justify?: StackJustify;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function mapAlign(align: StackAlign): FlexAlignType {
  switch (align) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    case 'start':
    default:
      return 'flex-start';
  }
}

function mapJustify(justify: StackJustify): ViewStyle['justifyContent'] {
  switch (justify) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'between':
      return 'space-between';
    case 'start':
    default:
      return 'flex-start';
  }
}

/**
 * Token-based flex stack — vertical or horizontal with consistent gaps.
 */
export function Stack({
  children,
  direction = 'vertical',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  style,
  testID,
}: StackProps) {
  const { theme } = useTheme();
  const gapValue = theme.spacing[gap];

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
          alignItems: mapAlign(align),
          justifyContent: mapJustify(justify),
          gap: gapValue,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
