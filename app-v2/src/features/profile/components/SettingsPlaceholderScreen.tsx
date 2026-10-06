import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer } from '@/components';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { spacing, spacingRoles } from '@/design/spacing';
import { navigateBackSafely } from '@/features/navigation/safe-back-navigation';
import { useScreenBottomInset } from '@/platform/screen-insets';

export interface SettingsPlaceholderScreenProps {
  title: string;
  description: string;
}

export function SettingsPlaceholderScreen({ title, description }: SettingsPlaceholderScreenProps) {
  const router = useRouter();
  const bottomInset = useScreenBottomInset();

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          <AppText role="titleLarge">{title}</AppText>
          <AppText role="bodyMuted">{description}</AppText>
          <SecondaryButton label="Zurück" onPress={() => navigateBackSafely(router, '/(tabs)/profile')} />
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
});
