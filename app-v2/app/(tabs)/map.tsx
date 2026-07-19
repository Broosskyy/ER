import { lazy, Suspense, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components';
import { colors } from '@/design/colors';
import {
  ENABLE_NATIVE_MAP,
  MapConfigurationFallback,
  MapDiagnosticState,
  canMountNativeMapView,
} from '@/features/map';

const NativeEventMap = lazy(() => import('@/features/map/components/NativeEventMap'));

export default function MapTabScreen() {
  const router = useRouter();

  const handleExploreEvents = useCallback(() => {
    router.navigate('/(tabs)/search');
  }, [router]);

  if (!ENABLE_NATIVE_MAP) {
    return (
      <AppScreen>
        <MapDiagnosticState />
      </AppScreen>
    );
  }

  if (!canMountNativeMapView()) {
    return (
      <AppScreen>
        <MapConfigurationFallback />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Suspense
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        }
      >
        <NativeEventMap onExploreEvents={handleExploreEvents} />
      </Suspense>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12121a',
  },
});
