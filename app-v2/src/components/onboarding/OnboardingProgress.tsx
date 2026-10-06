import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  skipped?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 03–06 dot progress indicator. */
export function OnboardingProgress({
  currentStep,
  totalSteps,
  skipped = false,
  style,
  testID,
}: OnboardingProgressProps) {
  const { theme } = useTheme();
  const accessibilityLabel = skipped
    ? `Onboarding übersprungen, Schritt ${currentStep} von ${totalSteps}`
    : `Onboarding Schritt ${currentStep} von ${totalSteps}`;

  return (
    <View style={[styles.root, style]} testID={testID} accessibilityLabel={accessibilityLabel}>
      <AppText role="caption" color={theme.colors.accent}>
        STEP {currentStep} OF {totalSteps}
      </AppText>
      <View style={styles.dots} accessibilityRole="progressbar">
        {Array.from({ length: totalSteps }, (_, index) => {
          const active = index + 1 === currentStep;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: active ? theme.colors.accent : theme.colors.borderSubtle,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
