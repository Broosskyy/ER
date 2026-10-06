import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { TermsAgreementViewModel } from '../onboarding/view-models';

export interface TermsAgreementProps {
  agreement: TermsAgreementViewModel;
  onToggleTerms?: () => void;
  onTogglePrivacy?: () => void;
  onToggleMarketing?: () => void;
  onPressTerms?: () => void;
  onPressPrivacy?: () => void;
  errorText?: string;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 08 registration terms checkbox — UI-only. */
export function TermsAgreement({
  agreement,
  onToggleTerms,
  onTogglePrivacy,
  onToggleMarketing,
  onPressTerms,
  onPressPrivacy,
  errorText,
  disabled = false,
  style,
  testID,
}: TermsAgreementProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.root, style]} testID={testID}>
      <AgreementRow
        checked={agreement.acceptTerms}
        label={agreement.termsLabel}
        onToggle={onToggleTerms}
        onPressLink={onPressTerms}
        disabled={disabled}
      />
      <AgreementRow
        checked={agreement.acceptPrivacy}
        label={agreement.privacyLabel}
        onToggle={onTogglePrivacy}
        onPressLink={onPressPrivacy}
        disabled={disabled}
      />
      {agreement.marketingLabel ? (
        <AgreementRow
          checked={Boolean(agreement.acceptMarketing)}
          label={agreement.marketingLabel}
          onToggle={onToggleMarketing}
          disabled={disabled}
        />
      ) : null}
      {errorText ? (
        <AppText role="caption" color={theme.colors.destructive}>
          {errorText}
        </AppText>
      ) : null}
    </View>
  );
}

function AgreementRow({
  checked,
  label,
  onToggle,
  onPressLink,
  disabled,
}: {
  checked: boolean;
  label: string;
  onToggle?: () => void;
  onPressLink?: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={[
          styles.checkbox,
          {
            borderColor: checked ? theme.colors.accent : theme.colors.borderSubtle,
            backgroundColor: checked ? theme.colors.accentMuted : theme.colors.transparent,
          },
        ]}
      >
        {checked ? <AppIcon name="checkmark" size="sm" color={theme.colors.accent} /> : null}
      </Pressable>
      <Pressable onPress={onPressLink} disabled={!onPressLink} style={styles.labelPress}>
        <AppText role="caption" color={theme.colors.textSecondary}>
          {label}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  labelPress: {
    flex: 1,
  },
});
