import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/design/colors';

export function MapLoadingOverlay() {
  return (
    <View style={styles.container} pointerEvents="none">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 15, 0.35)',
  },
});
