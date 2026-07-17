import { StyleSheet } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { colors } from '@/design/colors';

export default function MapPlaceholderScreen() {
  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent centered>
          <AppText variant="heading">Map</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} style={styles.note}>
            Map screen — coming in a future sprint.
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
