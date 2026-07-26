import { ReactNode, useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { overlayMetrics, resolveOverlayStyle } from './overlay-styles';

export interface BottomSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Mobile bottom sheet overlay — mockup 58/59.
 */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  style,
  testID,
}: BottomSheetProps) {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const resolved = resolveOverlayStyle(theme);
  const useCenteredFallback = Platform.OS === 'web' && height < 640;

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={useCenteredFallback ? 'fade' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.root,
          useCenteredFallback && styles.rootCentered,
        ]}
        testID={testID}
      >
        <Pressable
          style={[styles.scrim, { backgroundColor: resolved.scrimColor }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
        <View
          style={[
            useCenteredFallback ? styles.sheetFallback : styles.sheet,
            {
              backgroundColor: resolved.surfaceColor,
              borderTopLeftRadius: theme.radiusRoles.bottomSheet,
              borderTopRightRadius: theme.radiusRoles.bottomSheet,
              borderColor: resolved.borderColor,
              maxHeight: height * overlayMetrics.bottomSheetMaxHeightRatio,
              paddingHorizontal: overlayMetrics.padding,
              paddingTop: overlayMetrics.padding,
              paddingBottom: overlayMetrics.padding + insets.bottom,
              gap: overlayMetrics.gap,
            },
            useCenteredFallback && {
              borderRadius: theme.radiusRoles.card,
              marginHorizontal: overlayMetrics.padding,
            },
            style,
          ]}
        >
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.colors.borderStrong },
            ]}
            accessibilityElementsHidden
          />
          {title ? <AppText role="titleMedium">{title}</AppText> : null}
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rootCentered: {
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopWidth: overlayMetrics.borderWidth,
    width: '100%',
  },
  sheetFallback: {
    borderWidth: overlayMetrics.borderWidth,
    width: 'auto',
    alignSelf: 'center',
    maxWidth: spacing.xxl * 16,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xxl,
    height: spacing.xs,
    borderRadius: spacing.xs,
    marginBottom: spacing.sm,
  },
  footer: {
    gap: overlayMetrics.gap,
  },
});
