import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import {
  CREATE_OPTIONS,
  isCreateContributionOptionId,
} from '@/features/create/create-hub-config';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export default function CreatePlaceholderScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{ option?: string }>();
  const optionId = typeof params.option === 'string' ? params.option : undefined;
  const isValidOption = isCreateContributionOptionId(optionId);

  if (optionId === 'event') {
    return <Redirect href="/create/event" />;
  }

  const option = isValidOption ? CREATE_OPTIONS.find((entry) => entry.id === optionId) : undefined;

  if (!isValidOption || !optionId) {
    return <Redirect href="/create" />;
  }

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
          <View style={styles.content}>
            <AppText accessibilityRole="header" style={styles.title}>
              {option ? t(`create.options.${option.id}.title`) : t('create.placeholders.fallbackTitle')}
            </AppText>
            <AppText style={styles.message}>{t(`create.placeholders.${optionId}`)}</AppText>
          </View>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  title: {
    ...textRoles.screenTitle,
  },
  message: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
});
