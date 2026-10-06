import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer } from '@/components';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { spacing, spacingRoles } from '@/design/spacing';
import { useScreenBottomInset } from '@/platform/screen-insets';

export default function SettingsOverviewScreen() {
  const router = useRouter();
  const bottomInset = useScreenBottomInset();

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          <AppText role="titleLarge">Einstellungen</AppText>
          <AppText role="bodyMuted">Verwalte Account, Darstellung, Standort und Datenschutz.</AppText>
          <View style={styles.links}>
            <SecondaryButton label="Account" onPress={() => router.push('/settings/account')} />
            <SecondaryButton label="Benachrichtigungen" onPress={() => router.push('/settings/notifications')} />
            <SecondaryButton label="Darstellung" onPress={() => router.push('/settings/appearance')} />
            <SecondaryButton label="Standort" onPress={() => router.push('/settings/location')} />
            <SecondaryButton label="Datenschutz" onPress={() => router.push('/settings/privacy')} />
            <SecondaryButton label="Hilfe" onPress={() => router.push('/settings/help')} />
            <SecondaryButton label="Über Eternal Rave" onPress={() => router.push('/settings/about')} />
          </View>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
  },
  links: { gap: spacing.sm },
});
