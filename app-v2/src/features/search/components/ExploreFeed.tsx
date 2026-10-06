import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { spacingRoles } from '@/design/spacing';

export function ExploreFeed() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Keine Events gefunden"
        description="Die Suche ist bereit, aber der Event-Core enthält noch keine veröffentlichten Events."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingRoles.screenHorizontal,
    justifyContent: 'center',
  },
});
