import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { StyleSheet } from 'react-native';

import { ActivityContent } from '@/features/activity';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export default function NotificationsScreen() {
  useWebPageTitle('webTitles.notifications');

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <ActivityContent presentation="screen" />
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});
