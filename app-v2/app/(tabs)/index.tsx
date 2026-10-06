import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { spacingRoles } from '@/design/spacing';
import { HomeHeader, LocationSelector } from '@/features/home/components';
import { HomeFeedContent } from '@/features/home/components/HomeFeedContent';
import { homeGoldenSpacing } from '@/features/home/home-golden-spacing';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.home, '/');

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <HomeHeader />
          <View style={styles.locationRow}>
            <LocationSelector />
          </View>
          <HomeFeedContent />
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  locationRow: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: homeGoldenSpacing.locationBottom,
  },
});
