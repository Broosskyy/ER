import { useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppTextInput, type AppTextInputProps } from '@/components/inputs/AppTextInput';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';

export interface PasswordFieldProps extends Omit<AppTextInputProps, 'secureTextEntry' | 'prefixIcon'> {
  containerStyle?: ViewStyle;
}

/** Password input with show/hide — mockup 07/08. */
export function PasswordField({ containerStyle, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <AppTextInput
        prefixIcon="lock-closed-outline"
        secureTextEntry={!visible}
        textContentType="password"
        autoComplete="password"
        {...rest}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
        onPress={() => setVisible((current) => !current)}
        hitSlop={spacing.sm}
        style={styles.toggle}
      >
        <AppIcon name={visible ? 'eye-off-outline' : 'eye-outline'} size="sm" colorRole="muted" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  toggle: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.xl + spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
