import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppScreen } from '@/components/layout/AppScreen';
import { colors } from '@/design/colors';

interface BootstrapGateProps {
  ready: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}

export function BootstrapGate({ ready, error, onRetry, children }: BootstrapGateProps) {
  if (ready) {
    return children;
  }

  if (error) {
    return (
      <AppScreen testID="bootstrap-error">
        <View style={styles.centered}>
          <EmptyState
            title="App konnte nicht starten"
            description={error}
            action={<PrimaryButton label="Erneut versuchen" onPress={onRetry} />}
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen testID="bootstrap-loading">
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} testID="bootstrap-spinner" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
