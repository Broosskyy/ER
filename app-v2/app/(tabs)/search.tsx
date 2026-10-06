import { StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

export default function SearchScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.search);
  const { t } = useAppTranslation();

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen style={styles.container}>
          <AppText role="titleLarge" style={styles.title}>
            {t('search.title')}
          </AppText>
          <View style={styles.stateWrap}>
            <EmptyState
              title="Keine Events gefunden"
              description="Die Suche ist bereit, aber der Event-Core enthält noch keine veröffentlichten Events."
            />
          </View>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  title: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
