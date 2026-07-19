import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useNetworkStatus } from '@/platform/network/use-network-status';
import {
  activateWaitingServiceWorker,
  onServiceWorkerUpdate,
  registerServiceWorker,
} from '@/platform/pwa/register-service-worker';

export function PwaProvider({ children }: { children: ReactNode }) {
  const { isOnline, isSupported } = useNetworkStatus();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    void registerServiceWorker();
    return onServiceWorkerUpdate(() => setUpdateAvailable(true));
  }, []);

  return (
    <>
      {children}
      {Platform.OS === 'web' && isSupported && !isOnline ? (
        <View style={styles.banner} accessibilityRole="alert">
          <AppText style={styles.bannerText}>
            Keine Verbindung. Bitte prüfe dein Netzwerk und versuche es erneut.
          </AppText>
        </View>
      ) : null}
      {Platform.OS === 'web' && updateAvailable ? (
        <View style={styles.updateBanner}>
          <AppText style={styles.bannerText}>Eine neue Version ist verfügbar.</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={activateWaitingServiceWorker}
            style={styles.updateButton}
          >
            <AppText style={styles.updateButtonText}>Neu laden</AppText>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    zIndex: 1000,
  },
  updateBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    zIndex: 1000,
  },
  bannerText: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  updateButton: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  updateButtonText: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
});
