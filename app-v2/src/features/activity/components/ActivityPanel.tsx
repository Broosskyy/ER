import { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { ActivityContent } from '@/features/activity/components/ActivityContent';
import { resolveActivityPanelLayout } from '@/features/activity/activity-panel-layout';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface ActivityPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function ActivityPanel({ visible, onClose }: ActivityPanelProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useAppTranslation();
  const layout = resolveActivityPanelLayout(Platform.OS);
  const panelWidth = Math.min(420, Math.round(width * 0.92));

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, visible]);

  return (
    <Modal
      visible={visible}
      animationType={layout === 'mobile-modal' ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.overlay,
          layout === 'web-drawer' ? styles.overlayWeb : styles.overlayMobile,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('activity.closeA11y')}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View
          style={[
            styles.panel,
            layout === 'web-drawer'
              ? { width: panelWidth, paddingTop: insets.top }
              : { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
          testID="activity-panel"
        >
          <ActivityContent presentation="panel" onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  overlayWeb: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  overlayMobile: {
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  panel: {
    backgroundColor: colors.background,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    zIndex: 1,
  },
});
