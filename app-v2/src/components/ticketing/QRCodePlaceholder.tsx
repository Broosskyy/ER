import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { componentSize } from '@/design/layout';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export type QRCodePlaceholderStatus = 'valid' | 'used' | 'expired' | 'hidden' | 'loading';

export interface QRCodePlaceholderProps {
  status: QRCodePlaceholderStatus;
  hintLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Structural QR ticket surface from mockup 17; deliberately renders no scannable payload. */
export function QRCodePlaceholder({ status, hintLabel, style, testID }: QRCodePlaceholderProps) {
  const { theme } = useTheme();
  const isLoading = status === 'loading';
  const isHidden = status === 'hidden';
  const message = hintLabel ?? statusLabel(status);
  const color = status === 'valid' ? theme.colors.success : status === 'used' || status === 'expired' ? theme.colors.textMuted : theme.colors.accent;

  return (
    <View
      testID={testID}
      accessibilityLabel={`QR ticket: ${message}`}
      style={[styles.container, { borderColor: theme.colors.accentMuted, backgroundColor: theme.colors.surface }, style]}
    >
      <View style={[styles.code, { backgroundColor: theme.colors.white, opacity: isHidden ? 0.35 : 1 }]}>
        {isLoading ? <ActivityIndicator color={theme.colors.accent} /> : <AppIcon name={isHidden ? 'eye-off-outline' : 'qr-code-outline'} size="lg" color={theme.colors.background} />}
      </View>
      <View style={styles.status}>
        <AppIcon name={statusIcon(status)} size="sm" color={color} />
        <AppText role="bodyStrong" color={color}>{message}</AppText>
      </View>
    </View>
  );
}

function statusLabel(status: QRCodePlaceholderStatus) {
  switch (status) {
    case 'valid': return 'Gültig';
    case 'used': return 'Bereits verwendet';
    case 'expired': return 'Abgelaufen';
    case 'hidden': return 'Code verborgen';
    case 'loading': return 'Code wird geladen';
  }
}

function statusIcon(status: QRCodePlaceholderStatus) {
  switch (status) {
    case 'valid': return 'checkmark-circle' as const;
    case 'used': return 'checkmark-done-outline' as const;
    case 'expired': return 'time-outline' as const;
    case 'hidden': return 'eye-off-outline' as const;
    case 'loading': return 'hourglass-outline' as const;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: borderWidth.hairline,
    borderStyle: 'dashed',
  },
  code: {
    width: componentSize.ticketQrCodeSize,
    height: componentSize.ticketQrCodeSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
