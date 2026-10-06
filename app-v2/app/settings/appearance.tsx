import { AppearanceSettingsSheet } from '@/features/profile/components';
import { useState } from 'react';
import { View } from 'react-native';
import { AppScreen, AppText, SafeAreaContainer } from '@/components';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';

export default function SettingsAppearanceScreen() {
  const [open, setOpen] = useState(true);

  return (
    <AppScreen>
      <SafeAreaContainer>
        <View style={{ padding: 16, gap: 12 }}>
          <AppText role="titleLarge">Darstellung</AppText>
          <AppText role="bodyMuted">Passe Theme und Erscheinungsbild an.</AppText>
          <SecondaryButton label="Darstellung öffnen" onPress={() => setOpen(true)} />
        </View>
        <AppearanceSettingsSheet visible={open} onClose={() => setOpen(false)} />
      </SafeAreaContainer>
    </AppScreen>
  );
}
