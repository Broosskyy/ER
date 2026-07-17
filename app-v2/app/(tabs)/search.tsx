import { StyleSheet } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { colors } from '@/design/colors';

export default function SearchPlaceholderScreen() {
  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent centered>
          <AppText variant="heading">Events</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} style={styles.note}>
            Search screen — coming in a future sprint.
          </AppText>
        </ScreenContent>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: 8,
    textAlign: 'center',
  },
});
