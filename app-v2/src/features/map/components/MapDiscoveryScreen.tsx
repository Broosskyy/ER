import { StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { EmptyState } from '@/components/feedback/EmptyState';
import { spacingRoles } from '@/design/spacing';

export function MapDiscoveryScreen() {
  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen style={styles.container}>
          <View style={styles.stateWrap}>
            <EmptyState
              title="Keine Events auf der Karte"
              description="Sobald veröffentlichte Events im neuen Event-Core vorhanden sind, erscheinen sie hier."
            />
          </View>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
