import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface FormFieldProps {
  label: string;
  helper?: string;
  error?: string;
  nativeId?: string;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
}

export function FormField({
  label,
  helper,
  error,
  nativeId,
  required,
  optionalLabel,
  children,
}: FormFieldProps) {
  const labelText =
    required === true
      ? `${label} *`
      : optionalLabel
        ? `${label} (${optionalLabel})`
        : label;

  return (
    <View style={styles.container}>
      <AppText nativeID={nativeId} style={styles.label}>
        {labelText}
      </AppText>
      {children}
      {helper ? <AppText style={styles.helper}>{helper}</AppText> : null}
      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  helper: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
});
