import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';

import { resolveToastStyle, toastMetrics, type ToastVariant } from './toast-styles';

const toastIcons: Record<ToastVariant, AppIconName> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  error: 'close-circle',
};

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Snackbar UI primitive — mockup 61.
 */
export function Toast({ message, variant = 'info', onClose, style, testID }: ToastProps) {
  const { theme } = useTheme();
  const resolved = resolveToastStyle(theme.colors, variant);

  return (
    <View
      testID={testID}
      style={[
        styles.toast,
        {
          backgroundColor: resolved.backgroundColor,
          borderColor: resolved.borderColor,
          borderRadius: toastMetrics.borderRadius,
          paddingHorizontal: toastMetrics.paddingHorizontal,
          paddingVertical: toastMetrics.paddingVertical,
          borderWidth: toastMetrics.borderWidth,
        },
        style,
      ]}
      accessibilityRole="alert"
    >
      <AppIcon name={toastIcons[variant]} size="sm" color={resolved.iconColor} />
      <AppText role="body" color={resolved.textColor} style={styles.message}>
        {message}
      </AppText>
      {onClose ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close notification"
          hitSlop={8}
        >
          <AppIcon name="close" size="sm" color={resolved.iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: toastMetrics.gap,
    alignSelf: 'stretch',
  },
  message: {
    flex: 1,
  },
});
