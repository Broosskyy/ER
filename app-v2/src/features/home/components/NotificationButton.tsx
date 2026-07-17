import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { colors } from '@/design/colors';

export function NotificationButton() {
  return (
    <View style={styles.wrap}>
      <IconButton
        icon="notifications-outline"
        accessibilityLabel="Notifications"
        onPress={() => undefined}
      />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.background,
  },
});
