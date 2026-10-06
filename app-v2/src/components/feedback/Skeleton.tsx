import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';

import { resolveSkeletonStyle, skeletonMetrics, type SkeletonShape } from './skeleton-styles';

export interface SkeletonProps {
  shape?: SkeletonShape;
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Content-shaped loading placeholder — mockup 60.
 */
export function Skeleton({
  shape = 'rectangle',
  width,
  height,
  style,
  testID,
}: SkeletonProps) {
  const { theme } = useTheme();
  const pulse = useMemo(() => new Animated.Value(0), []);
  const resolved = resolveSkeletonStyle(theme.colors);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.7],
  });

  const dimensions = getSkeletonDimensions(shape, width, height);

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.base,
        dimensions,
        {
          backgroundColor: resolved.backgroundColor,
          opacity,
        },
        style,
      ]}
    />
  );
}

function getSkeletonDimensions(
  shape: SkeletonShape,
  width?: number | `${number}%`,
  height?: number,
): ViewStyle {
  switch (shape) {
    case 'text':
      return {
        width: width ?? '100%',
        height: height ?? skeletonMetrics.textHeight,
        borderRadius: skeletonMetrics.textRadius,
      };
    case 'circle':
      return {
        width: width ?? skeletonMetrics.circleSize,
        height: height ?? skeletonMetrics.circleSize,
        borderRadius: skeletonMetrics.circleSize,
      };
    case 'card':
      return {
        width: width ?? '100%',
        height: height ?? skeletonMetrics.cardHeight,
        borderRadius: skeletonMetrics.cardRadius,
      };
    case 'thumbnail':
      return {
        width: width ?? skeletonMetrics.thumbnailWidth,
        height: height ?? skeletonMetrics.thumbnailHeight,
        borderRadius: skeletonMetrics.thumbnailRadius,
      };
    case 'rect':
    case 'rectangle':
    default:
      return {
        width: width ?? '100%',
        height: height ?? skeletonMetrics.rectHeight,
        borderRadius: skeletonMetrics.rectRadius,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
