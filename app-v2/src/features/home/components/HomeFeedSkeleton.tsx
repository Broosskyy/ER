import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/feedback/Skeleton';
import { spacingRoles } from '@/design/spacing';
import { homeGoldenSpacing } from '@/features/home/home-golden-spacing';

export function HomeFeedSkeleton() {
  return (
    <View style={styles.container} testID="home-feed-skeleton">
      <Skeleton shape="text" width="45%" height={24} />
      <Skeleton shape="card" height={220} />
      <Skeleton shape="text" width="40%" height={24} style={styles.sectionGap} />
      <Skeleton shape="card" height={120} />
      <Skeleton shape="card" height={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: homeGoldenSpacing.tonightRowGap,
    paddingTop: homeGoldenSpacing.firstSectionTop,
  },
  sectionGap: {
    marginTop: homeGoldenSpacing.sectionGap,
  },
});
