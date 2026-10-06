import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { ETERNAL_RAVE_LOGO_CONFIG } from './eternal-rave-logo';

export type EternalRaveLogoVariant = 'header' | 'compact';

export interface EternalRaveLogoProps {
  variant?: EternalRaveLogoVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Single app-wide Eternal Rave logo entry point — image or wordmark fallback. */
export function EternalRaveLogo({
  variant = 'header',
  style,
  testID = 'eternal-rave-logo',
}: EternalRaveLogoProps) {
  const { theme } = useTheme();
  const { imageSource, showWordmarkWithImage, wordmark } = ETERNAL_RAVE_LOGO_CONFIG;
  const metrics = variant === 'compact' ? compactMetrics : headerMetrics;

  return (
    <View testID={testID} style={[styles.container, style]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={metrics.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {!imageSource || showWordmarkWithImage ? (
        <AppText role="label" color={theme.colors.accent} style={metrics.wordmark}>
          {wordmark}
        </AppText>
      ) : null}
    </View>
  );
}

const headerMetrics = {
  image: {
    width: 28,
    height: 28,
  },
  wordmark: {
    letterSpacing: 1.35,
    textTransform: 'uppercase' as const,
  },
};

const compactMetrics = {
  image: {
    width: 22,
    height: 22,
  },
  wordmark: {
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
});
