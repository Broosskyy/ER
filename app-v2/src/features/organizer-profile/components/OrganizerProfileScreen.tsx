import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { OrganizerMetricGrid } from '@/components/organizer/OrganizerDashboard';
import {
  OrganizerProfileSectionCard,
  ProfileCompletionCard,
  SocialLinkRow,
} from '@/components/organizer/ProfileComponents';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { PROFILE_MY_EVENTS_ROUTE, PROFILE_ORGANIZER_ROUTE } from '@/features/create/constants/contributor-event-routes';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
import { getOrCreateOrganizerProfile } from '@/features/organizer-profile/organizer-profile-storage';
import type { OrganizerProfileRecord } from '@/features/organizer-profile/types/organizer-profile';
import { buildOrganizerProfileCompletion } from '@/features/organizer-profile/utils/organizer-profile-completion';
import {
  buildOrganizerLocalStats,
  mapOrganizerProfileToHeader,
  mapOrganizerSocialLinks,
} from '@/features/organizer-profile/utils/organizer-profile-mapper';

export function OrganizerProfileScreen() {
  useWebPageTitle('webTitles.organizerProfile');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<OrganizerProfileRecord | null>(null);
  const [stats, setStats] = useState(buildOrganizerLocalStats([]));
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const [loadedProfile, events] = await Promise.all([
      getOrCreateOrganizerProfile(user.id, {
        name: user.email?.split('@')[0] ?? '',
        contactEmail: user.email ?? '',
      }),
      contributorEventService.getMyEvents(user.id),
    ]);

    setProfile(loadedProfile);
    setStats(buildOrganizerLocalStats(events));
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        return;
      }

      void loadProfile();
    }, [loadProfile, user?.id]),
  );

  if (authLoading || loading) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <AppText style={styles.loadingText}>{t('organizerProfile.loading')}</AppText>
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!isAuthenticated || !user || !profile) {
    router.replace(buildLoginHref(PROFILE_ORGANIZER_ROUTE) as '/login');
    return null;
  }

  const completion = buildOrganizerProfileCompletion(profile);
  const header = mapOrganizerProfileToHeader(profile);
  const socialLinks = mapOrganizerSocialLinks(profile);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.header}>
            <IconButton
              icon="arrow-back"
              accessibilityLabel={t('common.actions.back')}
              onPress={() => router.back()}
            />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {profile.bannerUri ? (
              <Image
                accessibilityLabel={t('organizerProfile.bannerLabel')}
                source={{ uri: profile.bannerUri }}
                style={styles.banner}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <AppText role="caption">{t('organizerProfile.noBanner')}</AppText>
              </View>
            )}

            <ProfileHeader
              profile={header}
              primaryAction={
                <PrimaryButton
                  label={t('organizerProfile.actions.edit')}
                  onPress={() => router.push('/profile/organizer/edit')}
                />
              }
              secondaryAction={
                <SecondaryButton
                  label={t('organizerProfile.actions.preview')}
                  onPress={() => router.push('/profile/organizer/edit?preview=1')}
                />
              }
            />

            <ProfileCompletionCard
              completion={completion}
              onCtaPress={() => router.push('/profile/organizer/edit')}
            />

            <OrganizerMetricGrid metrics={stats} />

            <OrganizerProfileSectionCard title={t('organizerProfile.sections.contact.title')}>
              <AppText role="bodyMuted">
                {profile.contactEmail.trim() || t('organizerProfile.sections.contact.emptyEmail')}
              </AppText>
              <AppText role="bodyMuted">
                {profile.contactPhone.trim() || t('organizerProfile.sections.contact.emptyPhone')}
              </AppText>
            </OrganizerProfileSectionCard>

            <OrganizerProfileSectionCard title={t('organizerProfile.sections.social.title')}>
              {socialLinks.length > 0 ? (
                socialLinks.map((link) => <SocialLinkRow key={link.id} link={link} />)
              ) : (
                <AppText role="bodyMuted">{t('organizerProfile.sections.social.empty')}</AppText>
              )}
            </OrganizerProfileSectionCard>

            <SecondaryButton
              label={t('profile.myEvents.open')}
              onPress={() => router.push(PROFILE_MY_EVENTS_ROUTE)}
            />
          </ScrollView>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
  },
  banner: {
    width: '100%',
    height: 160,
    borderRadius: 16,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
