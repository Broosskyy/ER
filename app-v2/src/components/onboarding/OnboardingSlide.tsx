import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Badge } from '@/components/feedback/Badge';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { OnboardingSlideViewModel } from './view-models';

export interface OnboardingSlideProps {
  slide: OnboardingSlideViewModel;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockup 03–06 onboarding slide — no pager logic. */
export function OnboardingSlide({ slide, style, testID }: OnboardingSlideProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.root, style]} testID={testID} accessibilityLabel={slide.accessibilityLabel}>
      {slide.image ? (
        <Image source={slide.image} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : null}
      {slide.stepLabel ? (
        <AppText role="caption" color={theme.colors.accent}>
          {slide.stepLabel}
        </AppText>
      ) : null}
      <View style={styles.titleRow}>
        <AppText role="titleLarge" style={styles.title}>
          {slide.title}
        </AppText>
        {slide.highlightedTitle ? (
          <AppText role="titleLarge" color={theme.colors.accent} style={styles.title}>
            {slide.highlightedTitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.accent }]} />
      <AppText role="bodyMuted" color={theme.colors.textSecondary} style={styles.description}>
        {slide.description}
      </AppText>
      {slide.badgeLabel ? <Badge label={slide.badgeLabel} status="info" /> : null}
      {slide.footerLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>
          {slide.footerLabel}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  divider: {
    width: 48,
    height: 2,
    borderRadius: 1,
  },
  description: {
    textAlign: 'center',
  },
});
