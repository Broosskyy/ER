import { ProfileScreenContent } from '@/features/profile/components/ProfileScreenContent';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { IconButton } from '@/components/buttons/IconButton';
import { spacing, spacingRoles } from '@/design/spacing';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
import { useScreenBottomInset } from '@/platform/screen-insets';

export default function ProfileScreen() {
  useWebPageTitle('webTitles.profile');
  const { t } = useAppTranslation();
  const bottomInset = useScreenBottomInset();

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        >
          <ScreenContent style={styles.content} padded={false}>
            <View style={styles.headerRow}>
              <AppText role="titleLarge">{t('profile.title')}</AppText>
            </View>
            <ProfileScreenContent />
          </ScreenContent>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  headerRow: {
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
