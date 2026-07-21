import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { colors } from '@/design/colors';
import { appConfig } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getProfileAuthLinks } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { PROFILE_MY_EVENTS_ROUTE } from '@/features/create/constants/contributor-event-routes';
import { LanguageSwitcher } from '@/features/i18n/components/LanguageSwitcher';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
import { useFavorites } from '@/features/favorites';
import {
  getProfileAdminHref,
  PROFILE_SCROLL_TEST_ID,
} from '@/features/profile/profile-screen-utils';
import { useScreenBottomInset } from '@/platform/screen-insets';

export default function ProfileScreen() {
  useWebPageTitle('webTitles.profile');
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const { t } = useAppTranslation();
  const { favoriteEvents, isHydrated } = useFavorites();
  const { user, isAuthenticated, loading, signOut, session } = useAuth();
  const savedCount = isHydrated ? favoriteEvents.length : 0;
  const { loginHref, registerHref } = getProfileAuthLinks();
  const adminHref = getProfileAdminHref(session);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ScrollView
          testID={PROFILE_SCROLL_TEST_ID}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        >
          <ScreenContent style={styles.content} padded={false}>
            <AppText variant="heading">{t('profile.title')}</AppText>

            <View style={styles.card}>
              <AppText style={styles.sectionTitle}>{t('profile.account.title')}</AppText>
              {loading ? (
                <AppText style={styles.value}>{t('common.labels.loading')}</AppText>
              ) : isAuthenticated && user ? (
                <View style={styles.accountSignedIn}>
                  <AppText style={styles.label}>{t('profile.account.signedInAs')}</AppText>
                  <AppText style={styles.value}>{user.email}</AppText>
                  <SecondaryButton
                    label={t('common.actions.logout')}
                    onPress={() => void handleSignOut()}
                  />
                </View>
              ) : (
                <View style={styles.accountSignedOut}>
                  <AppText style={styles.accountHint}>{t('profile.account.hint')}</AppText>
                  <PrimaryButton
                    label={t('common.actions.login')}
                    onPress={() => router.push(loginHref as '/login')}
                  />
                  <SecondaryButton
                    label={t('common.actions.register')}
                    onPress={() => router.push(registerHref as '/register')}
                  />
                </View>
              )}
            </View>

            {adminHref ? (
              <View style={styles.card}>
                <AppText style={styles.sectionTitle}>{t('profile.admin.title')}</AppText>
                <AppText style={styles.accountHint}>{t('profile.admin.description')}</AppText>
                <PrimaryButton
                  label={t('profile.admin.open')}
                  onPress={() => router.push(adminHref)}
                />
              </View>
            ) : null}

            {isAuthenticated ? (
              <View style={styles.card}>
                <AppText style={styles.sectionTitle}>{t('profile.myEvents.linkTitle')}</AppText>
                <AppText style={styles.accountHint}>{t('profile.myEvents.linkDescription')}</AppText>
                <PrimaryButton
                  label={t('profile.myEvents.open')}
                  onPress={() => router.push(PROFILE_MY_EVENTS_ROUTE)}
                />
              </View>
            ) : null}

            <View style={styles.card}>
              <LanguageSwitcher />
            </View>

            <View style={styles.card}>
              <AppText style={styles.label}>{t('profile.defaultCity')}</AppText>
              <AppText style={styles.value}>{appConfig.defaultCity}, Germany</AppText>
            </View>

            <View style={styles.card}>
              <AppText style={styles.label}>{t('profile.savedEvents')}</AppText>
              <AppText style={styles.value}>{isHydrated ? savedCount : t('common.labels.loading')}</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary} style={styles.note}>
                {t('profile.favoritesNote')}
              </AppText>
            </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 0,
    alignItems: 'stretch',
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.lg,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  accountSignedIn: {
    gap: spacing.sm,
  },
  accountSignedOut: {
    gap: spacing.md,
  },
  accountHint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  label: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  value: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  note: {
    marginTop: spacing.xs,
  },
});
