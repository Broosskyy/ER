import { StyleSheet } from 'react-native';

import {
  AppScreen,
  AppText,
  SafeAreaContainer,
  ScreenContent,
} from '@/components';
import { colors } from '@/design/colors';
import { appConfig } from '@/design/layout';
import { spacing } from '@/design/spacing';

export default function IndexScreen() {
  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent centered>
          <AppText variant="display" style={styles.title}>
            {appConfig.name}
          </AppText>
          <AppText variant="heading" color={colors.primary} style={styles.subtitle}>
            Technical rebuild initialized
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} style={styles.note}>
            Mockup-based screen implementation has not started yet.
          </AppText>
        </ScreenContent>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  note: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
