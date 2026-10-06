import { ReactNode, useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';

import { overlayMetrics, resolveOverlayStyle } from './overlay-styles';

export interface AppModalProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Centered modal overlay — mockup 58, desktop-first.
 */
export function AppModal({
  visible,
  title,
  onClose,
  children,
  footer,
  showCloseButton = true,
  style,
  testID,
}: AppModalProps) {
  const { theme } = useTheme();
  const resolved = resolveOverlayStyle(theme);

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
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.root} testID={testID}>
        <Pressable
          style={[styles.scrim, { backgroundColor: resolved.scrimColor }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
        <View
          style={[
            styles.modal,
            {
              backgroundColor: resolved.surfaceColor,
              borderRadius: theme.radiusRoles.card,
              borderColor: resolved.borderColor,
              maxWidth: overlayMetrics.modalMaxWidth,
              padding: overlayMetrics.padding,
              gap: overlayMetrics.gap,
            },
            style,
          ]}
        >
          <View style={styles.header}>
            {title ? <AppText role="titleMedium">{title}</AppText> : <View style={styles.headerSpacer} />}
            {showCloseButton ? (
              <IconButton
                icon="close"
                size="sm"
                accessibilityLabel="Close modal"
                onPress={onClose}
              />
            ) : null}
          </View>
          <View>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: overlayMetrics.padding,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  modal: {
    width: '100%',
    borderWidth: overlayMetrics.borderWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: overlayMetrics.gap,
  },
  headerSpacer: {
    flex: 1,
  },
  footer: {
    gap: overlayMetrics.gap,
  },
});
