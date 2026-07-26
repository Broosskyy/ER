import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';

import { bannerMetrics, resolveBannerStyle, type BannerVariant } from './banner-styles';

const bannerIcons: Record<BannerVariant, AppIconName> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  error: 'close-circle',
};

export interface BannerProps {
  title: string;
  message?: string;
  /** Alias for message */
  text?: string;
  variant?: BannerVariant;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Inline full-width banner — mockup feedback section.
 */
export function Banner({
  title,
  message,
  text,
  variant = 'info',
  actionLabel,
  onAction,
  dismissible = false,
  onDismiss,
  style,
  testID,
}: BannerProps) {
  const { theme } = useTheme();
  const resolved = resolveBannerStyle(theme.colors, variant);
  const bodyText = message ?? text;

  return (
    <View
      testID={testID}
      style={[
        styles.banner,
        {
          backgroundColor: resolved.backgroundColor,
          borderColor: resolved.borderColor,
          borderRadius: bannerMetrics.borderRadius,
          paddingHorizontal: bannerMetrics.paddingHorizontal,
          paddingVertical: bannerMetrics.paddingVertical,
          borderWidth: bannerMetrics.borderWidth,
        },
        style,
      ]}
      accessibilityRole="summary"
    >
      <AppIcon name={bannerIcons[variant]} size="md" color={resolved.iconColor} />
      <View style={styles.content}>
        <AppText role="label" color={resolved.titleColor}>
          {title}
        </AppText>
        {bodyText ? (
          <AppText role="bodyMuted" color={resolved.messageColor}>
            {bodyText}
          </AppText>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button">
            <AppText role="label" color={resolved.titleColor}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {dismissible ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss banner"
          hitSlop={8}
        >
          <AppIcon name="close" size="sm" colorRole="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: bannerMetrics.gap,
    width: '100%',
  },
  content: {
    flex: 1,
    gap: bannerMetrics.gap / 2,
  },
});
