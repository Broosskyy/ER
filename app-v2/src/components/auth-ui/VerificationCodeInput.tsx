import { Pressable, StyleSheet, TextInput, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface VerificationCodeInputProps {
  length?: number;
  value?: string;
  onChangeText?: (value: string) => void;
  errorText?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Verification code input — no dedicated mockup screen, but required by registration architecture.
 * UI-only digit boxes without clipboard logic.
 */
export function VerificationCodeInput({
  length = 6,
  value = '',
  onChangeText,
  errorText,
  disabled = false,
  loading = false,
  style,
  testID,
}: VerificationCodeInputProps) {
  const { theme } = useTheme();
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View style={styles.row} accessibilityLabel="Verifizierungscode">
        {digits.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              {
                borderColor: errorText ? theme.colors.destructive : theme.colors.borderSubtle,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <AppText role="titleSmall">{digit.trim()}</AppText>
          </View>
        ))}
      </View>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText?.(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        editable={!disabled && !loading}
        style={styles.hiddenInput}
        accessibilityLabel="Verifizierungscode eingeben"
      />
      {errorText ? (
        <AppText role="caption" color={theme.colors.destructive}>
          {errorText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  cell: {
    width: 44,
    height: 52,
    borderRadius: radii.md,
    borderWidth: borderWidth.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
