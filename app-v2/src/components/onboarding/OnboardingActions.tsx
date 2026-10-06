import { StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextButton } from '@/components/buttons/TextButton';
import { spacing } from '@/design/spacing';

export interface OnboardingActionsProps {
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  onBackPress?: () => void;
  onSkipPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 03–06 onboarding footer actions. */
export function OnboardingActions({
  primaryLabel = 'Weiter',
  onPrimaryPress,
  onBackPress,
  onSkipPress,
  loading = false,
  disabled = false,
  style,
  testID,
}: OnboardingActionsProps) {
  return (
    <View style={[styles.root, style]} testID={testID}>
      <PrimaryButton
        label={primaryLabel}
        onPress={onPrimaryPress}
        loading={loading}
        disabled={disabled}
      />
      <View style={styles.secondaryRow}>
        {onBackPress ? <GhostButton label="Zurück" onPress={onBackPress} /> : <View />}
        {onSkipPress ? <TextButton label="Überspringen" onPress={onSkipPress} /> : <View />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    width: '100%',
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
