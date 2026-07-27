import { AppTextInput, type AppTextInputProps } from '@/components/inputs/AppTextInput';

export interface EmailFieldProps extends Omit<AppTextInputProps, 'prefixIcon' | 'keyboardType' | 'autoCapitalize'> {}

/** Email input wrapper — mockup 07/08. */
export function EmailField(props: EmailFieldProps) {
  return (
    <AppTextInput
      prefixIcon="mail-outline"
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="emailAddress"
      autoComplete="email"
      {...props}
    />
  );
}
