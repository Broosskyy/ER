import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { spacingRoles } from '@/design/spacing';

export function EventNotFoundState({ onGoBack }: { onGoBack: () => void }) {
  return (
    <View style={styles.container}>
      <AppText role="titleMedium">Event nicht gefunden</AppText>
      <AppText role="body" style={styles.description}>
        Dieses Event ist im neuen Event-Core noch nicht verfügbar.
      </AppText>
      <PrimaryButton label="Zurück" onPress={onGoBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  description: {
    marginBottom: 8,
  },
});
