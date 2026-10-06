import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing, spacingRoles } from '@/design/spacing';
import { getProfileAuthLinks } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useFavorites } from '@/features/favorites';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { resolveAccountCapabilities } from '@/features/profile/account-capability-resolver';
import { useUserProfile } from '@/features/profile/UserProfileProvider';

interface SettingsRowProps {
  label: string;
  icon: 'person-outline' | 'notifications-outline' | 'color-palette-outline' | 'location-outline' | 'shield-outline' | 'help-circle-outline' | 'information-circle-outline' | 'megaphone-outline';
  onPress: () => void;
}

function SettingsRow({ label, icon, onPress }: SettingsRowProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size="sm" color={theme.colors.accent} />
      <AppText role="body" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppIcon name="chevron-forward" size="sm" color={theme.colors.textMuted} />
    </Pressable>
  );
}

export function ProfileScreenContent() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { theme } = useTheme();
  const { profile } = useUserProfile();
  const { savedEvents, isHydrated } = useFavorites();
  const { user, session, isAuthenticated, loading, signOut } = useAuth();
  const { loginHref, registerHref } = getProfileAuthLinks();

  const capabilities = resolveAccountCapabilities({
    isAuthenticated,
    email: user?.email,
    role: session?.role,
    displayName: profile.displayName,
    username: profile.username,
    hasLinkedOrganizerProfile: false,
  });

  const savedCount = isHydrated ? savedEvents.length : 0;
  const headerDisplayName =
    profile.displayName.trim() && profile.displayName.trim() !== 'Rave Guest'
      ? profile.displayName.trim()
      : capabilities.displayName;

  const handleSignOut = () => {
    Alert.alert('Abmelden', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {isAuthenticated && user ? (
        <ProfileHeader
          profile={{
            id: profile.id,
            type: 'user',
            name: headerDisplayName,
            handleOrTypeLabel: capabilities.handleOrTypeLabel,
            bio: profile.bio,
            locationLabel: profile.city,
            verificationStatus: 'unverified',
            stats: [
              { id: 'events', valueLabel: String(savedCount), label: 'Gespeichert' },
            ],
            accessibilityLabel: `Profil von ${headerDisplayName}`,
          }}
          primaryAction={
            <SecondaryButton
              label="Profil bearbeiten"
              onPress={() => router.push('/profile/edit')}
            />
          }
        />
      ) : (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle }]}>
          <ProfileHeader
            profile={{
              id: profile.id,
              type: 'user',
              name: capabilities.displayName,
              handleOrTypeLabel: capabilities.handleOrTypeLabel,
              bio: profile.bio,
              locationLabel: profile.city,
              verificationStatus: 'unverified',
              stats: [{ id: 'events', valueLabel: String(savedCount), label: 'Gespeichert' }],
              accessibilityLabel: `Profil von ${headerDisplayName}`,
            }}
          />
          <AppText role="titleMedium">{t('profile.account.title')}</AppText>
          <AppText role="bodyMuted">{t('profile.account.hint')}</AppText>
          <PrimaryButton label={t('common.actions.login')} onPress={() => router.push(loginHref as '/login')} />
          <SecondaryButton
            label={t('common.actions.register')}
            onPress={() => router.push(registerHref as '/register')}
          />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle }]}>
        <AppText role="sectionTitle">Einstellungen</AppText>
        <SettingsRow label="Account" icon="person-outline" onPress={() => router.push('/settings/account')} />
        <SettingsRow
          label="Benachrichtigungen"
          icon="notifications-outline"
          onPress={() => router.push('/settings/notifications')}
        />
        <SettingsRow
          label="Darstellung"
          icon="color-palette-outline"
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingsRow
          label="Standort & Berechtigungen"
          icon="location-outline"
          onPress={() => router.push('/settings/location')}
        />
        <SettingsRow label="Datenschutz" icon="shield-outline" onPress={() => router.push('/settings/privacy')} />
        <SettingsRow label="Hilfe" icon="help-circle-outline" onPress={() => router.push('/settings/help')} />
        <SettingsRow
          label="Über Eternal Rave"
          icon="information-circle-outline"
          onPress={() => router.push('/settings/about')}
        />
        <SettingsRow
          label="Aktivitäten"
          icon="megaphone-outline"
          onPress={() => router.push('/activity')}
        />
      </View>

      {loading ? (
        <AppText role="bodyMuted">{t('common.labels.loading')}</AppText>
      ) : isAuthenticated ? (
        <SecondaryButton label={t('common.actions.logout')} onPress={handleSignOut} />
      ) : null}

      <AppText role="caption" color={theme.colors.textMuted}>
        {t('profile.favoritesNote')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
});
