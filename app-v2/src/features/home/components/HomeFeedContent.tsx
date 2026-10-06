import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { spacingRoles } from '@/design/spacing';
import { EventDiscoveryCard } from '@/features/events/components/EventDiscoveryCard';
import { usePublishedEvents } from '@/features/events/hooks/usePublishedEvents';

export function HomeFeedContent() {
  const { events, isEmpty } = usePublishedEvents();

  if (isEmpty) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          title="Keine Events vorhanden"
          description="Veröffentlichte Events erscheinen hier, sobald sie im Event-Core verfügbar sind."
        />
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(event) => event.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <EventDiscoveryCard event={item} variant="featuredHome" testID={`home-event-${item.id}`} />
      )}
      ListHeaderComponent={<View style={styles.listHeaderSpacer} />}
      testID="home-event-list"
    />
  );
}

const styles = StyleSheet.create({
  stateWrap: {
    flex: 1,
    paddingHorizontal: spacingRoles.screenHorizontal,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacingRoles.sectionGap,
    paddingBottom: spacingRoles.listBottomInset,
  },
  listHeaderSpacer: {
    height: 4,
  },
});
