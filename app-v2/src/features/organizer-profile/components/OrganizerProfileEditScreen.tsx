import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppScreen, SafeAreaContainer } from '@/components';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import {
  OrganizerProfileEditorHeader,
  OrganizerProfileSectionCard,
  ProfileCompletionCard,
} from '@/components/organizer/ProfileComponents';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { spacing, spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
import {
  getOrCreateOrganizerProfile,
  saveOrganizerProfile,
} from '@/features/organizer-profile/organizer-profile-storage';
import type { OrganizerProfileRecord } from '@/features/organizer-profile/types/organizer-profile';
import { buildOrganizerProfileCompletion } from '@/features/organizer-profile/utils/organizer-profile-completion';
import { mapOrganizerProfileToHeader } from '@/features/organizer-profile/utils/organizer-profile-mapper';
import { useScreenBottomInset } from '@/platform/screen-insets';

export function OrganizerProfileEditScreen() {
  useWebPageTitle('webTitles.organizerProfileEdit');
  const router = useRouter();
  const { theme } = useTheme();
  const bottomInset = useScreenBottomInset();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ preview?: string }>();
  const isPreview = params.preview === '1';
  const [profile, setProfile] = useState<OrganizerProfileRecord | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref('/profile/organizer/edit') as '/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void getOrCreateOrganizerProfile(user.id, {
      name: user.email?.split('@')[0] ?? '',
      contactEmail: user.email ?? '',
    }).then((loaded) => {
      setProfile(loaded);
      setLoading(false);
    });
  }, [user?.email, user?.id]);

  const completion = useMemo(
    () => (profile ? buildOrganizerProfileCompletion(profile) : null),
    [profile],
  );

  const handleSave = async () => {
    if (!profile) {
      return;
    }

    if (!profile.name.trim()) {
      Alert.alert(t('organizerProfile.edit.nameRequiredTitle'), t('organizerProfile.edit.nameRequiredMessage'));
      return;
    }

    await saveOrganizerProfile(profile);
    setDirty(false);
    router.back();
  };

  const handleBack = () => {
    if (!dirty) {
      router.back();
      return;
    }

    Alert.alert(t('organizerProfile.edit.unsavedTitle'), t('organizerProfile.edit.unsavedMessage'), [
      { text: t('organizerProfile.edit.keepEditing'), style: 'cancel' },
      { text: t('organizerProfile.edit.discard'), style: 'destructive', onPress: () => router.back() },
      { text: t('organizerProfile.actions.save'), onPress: () => void handleSave() },
    ]);
  };

  if (authLoading || loading || !profile) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.centered}>
          <AppText role="bodyMuted">{t('organizerProfile.loading')}</AppText>
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (isPreview) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.safeArea}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
            <AppText role="titleLarge">{t('organizerProfile.previewTitle')}</AppText>
            <ProfileHeader profile={mapOrganizerProfileToHeader(profile)} />
            <SecondaryButton label={t('common.actions.back')} onPress={() => router.back()} />
          </ScrollView>
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  const updateField = <K extends keyof OrganizerProfileRecord>(key: K, value: OrganizerProfileRecord[K]) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
  };

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          <OrganizerProfileEditorHeader
            name={profile.name.trim() || t('organizerProfile.unnamed')}
            verificationStatus="unverified"
            completionPercent={completion?.percent ?? 0}
            logo={profile.logoUri ? { uri: profile.logoUri } : undefined}
            previewLabel={t('organizerProfile.actions.preview')}
            onPreviewPress={() => router.push('/profile/organizer/edit?preview=1')}
          />

          {completion ? (
            <ProfileCompletionCard
              completion={completion}
              onCtaPress={() => undefined}
            />
          ) : null}

          <OrganizerProfileSectionCard title={t('organizerProfile.sections.basics.title')}>
            <Field
              label={t('organizerProfile.fields.name')}
              value={profile.name}
              onChangeText={(value) => updateField('name', value)}
              theme={theme}
            />
            <Field
              label={t('organizerProfile.fields.description')}
              value={profile.description}
              onChangeText={(value) => updateField('description', value)}
              theme={theme}
              multiline
            />
            <Field
              label={t('organizerProfile.fields.location')}
              value={profile.location}
              onChangeText={(value) => updateField('location', value)}
              theme={theme}
            />
            <Field
              label={t('organizerProfile.fields.website')}
              value={profile.website}
              onChangeText={(value) => updateField('website', value)}
              theme={theme}
              autoCapitalize="none"
            />
          </OrganizerProfileSectionCard>

          <OrganizerProfileSectionCard title={t('organizerProfile.sections.media.title')}>
            <Field
              label={t('organizerProfile.fields.logoUri')}
              value={profile.logoUri ?? ''}
              onChangeText={(value) => updateField('logoUri', value || undefined)}
              theme={theme}
              autoCapitalize="none"
            />
            <Field
              label={t('organizerProfile.fields.bannerUri')}
              value={profile.bannerUri ?? ''}
              onChangeText={(value) => updateField('bannerUri', value || undefined)}
              theme={theme}
              autoCapitalize="none"
            />
          </OrganizerProfileSectionCard>

          <OrganizerProfileSectionCard title={t('organizerProfile.sections.contact.title')}>
            <Field
              label={t('organizerProfile.fields.contactEmail')}
              value={profile.contactEmail}
              onChangeText={(value) => updateField('contactEmail', value)}
              theme={theme}
              autoCapitalize="none"
            />
            <Field
              label={t('organizerProfile.fields.contactPhone')}
              value={profile.contactPhone}
              onChangeText={(value) => updateField('contactPhone', value)}
              theme={theme}
            />
          </OrganizerProfileSectionCard>

          <View style={styles.actions}>
            <SecondaryButton label={t('common.actions.cancel')} onPress={handleBack} />
            <PrimaryButton label={t('organizerProfile.actions.save')} onPress={() => void handleSave()} />
          </View>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  theme,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <AppText role="label">{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { borderColor: theme.colors.borderSubtle, color: theme.colors.textPrimary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
  },
  field: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
