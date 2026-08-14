import { Modal, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { spacingRoles } from '@/design/spacing';

export function ActivityPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <AppText role="titleMedium">Aktivität</AppText>
          <AppText role="bodyMuted">Noch keine Aktivitäten im neuen Event-Core.</AppText>
          <PrimaryButton label="Schließen" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacingRoles.screenHorizontal,
  },
  panel: {
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#111',
  },
});
