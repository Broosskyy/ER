import { Stack } from 'expo-router';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { colors } from '@/design/colors';

export default function NotFoundScreen() {
  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent centered>
          <Stack.Screen options={{ title: 'Not Found' }} />
          <AppText variant="heading">Screen not found</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            This route does not exist.
          </AppText>
        </ScreenContent>
      </SafeAreaContainer>
    </AppScreen>
  );
}
