import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen, AppText, SafeAreaContainer } from '@/components';
import { spacing, spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import { useUserProfile } from '@/features/profile/UserProfileProvider';
import { useScreenBottomInset } from '@/platform/screen-insets';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const bottomInset = useScreenBottomInset();
  const { profile, updateProfile } = useUserProfile();
  const [draft, setDraft] = useState(profile);
  const [dirty, setDirty] = useState(false);

  const handleBack = () => {
    if (!dirty) {
      router.back();
      return;
    }

    Alert.alert('Ungespeicherte Änderungen', 'Möchtest du deine Änderungen verwerfen?', [
      { text: 'Weiter bearbeiten', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => router.back() },
      {
        text: 'Speichern',
        onPress: () => {
          void handleSave().then(() => router.back());
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!draft.displayName.trim()) {
      Alert.alert('Anzeigename erforderlich', 'Bitte gib einen Anzeigenamen ein.');
      return;
    }

    await updateProfile({
      displayName: draft.displayName.trim(),
      username: draft.username?.trim() || undefined,
      city: draft.city?.trim() || undefined,
      bio: draft.bio?.trim() || undefined,
      preferredGenres: draft.preferredGenres ?? [],
    });
    setDirty(false);
  };

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          <AppText role="titleLarge">Profil bearbeiten</AppText>
          <View style={styles.field}>
            <AppText role="label">Anzeigename</AppText>
            <TextInput
              value={draft.displayName}
              onChangeText={(value) => {
                setDraft((current) => ({ ...current, displayName: value }));
                setDirty(true);
              }}
              style={[styles.input, { borderColor: theme.colors.borderSubtle, color: theme.colors.textPrimary }]}
            />
          </View>
          <View style={styles.field}>
            <AppText role="label">Benutzername</AppText>
            <TextInput
              value={draft.username ?? ''}
              onChangeText={(value) => {
                setDraft((current) => ({ ...current, username: value }));
                setDirty(true);
              }}
              autoCapitalize="none"
              style={[styles.input, { borderColor: theme.colors.borderSubtle, color: theme.colors.textPrimary }]}
            />
          </View>
          <View style={styles.field}>
            <AppText role="label">Stadt</AppText>
            <TextInput
              value={draft.city ?? ''}
              onChangeText={(value) => {
                setDraft((current) => ({ ...current, city: value }));
                setDirty(true);
              }}
              style={[styles.input, { borderColor: theme.colors.borderSubtle, color: theme.colors.textPrimary }]}
            />
          </View>
          <View style={styles.field}>
            <AppText role="label">Bio</AppText>
            <TextInput
              value={draft.bio ?? ''}
              onChangeText={(value) => {
                setDraft((current) => ({ ...current, bio: value }));
                setDirty(true);
              }}
              multiline
              style={[
                styles.input,
                styles.multiline,
                { borderColor: theme.colors.borderSubtle, color: theme.colors.textPrimary },
              ]}
            />
          </View>
          <View style={styles.actions}>
            <SecondaryButton label="Abbrechen" onPress={handleBack} />
            <PrimaryButton label="Speichern" onPress={() => void handleSave().then(() => router.back())} />
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
