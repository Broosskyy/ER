import { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { EmptyState } from '@/components/feedback/EmptyState';
import { spacing, spacingRoles } from '@/design/spacing';
import { EventDiscoveryCard } from '@/features/events/components/EventDiscoveryCard';
import { usePublishedEvents } from '@/features/events/hooks/usePublishedEvents';
import { useFavoriteToggle } from '@/features/favorites';
import { SearchInput } from '@/features/search/components/SearchInput';
import { buildEventSearchIndex } from '@/features/search/constants';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

export default function SearchScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.search);
  const pathname = usePathname();
  const { events } = usePublishedEvents();
  const [query, setQuery] = useState('');
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle('/(tabs)/search');

  if (Platform.OS === 'web' && pathname !== '/search') {
    return null;
  }

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE');
    if (!normalized) {
      return events;
    }

    return events.filter((event) =>
      buildEventSearchIndex(event).toLocaleLowerCase('de-DE').includes(normalized),
    );
  }, [events, query]);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen style={styles.container}>
          <SearchInput value={query} onChangeText={setQuery} />

          {filteredEvents.length === 0 ? (
            <View style={styles.stateWrap}>
              <EmptyState
                title="Keine Events gefunden"
                description={
                  query.trim()
                    ? 'Für deine Suche wurden keine passenden Events gefunden.'
                    : 'Aktuell sind keine veröffentlichten Events verfügbar.'
                }
              />
            </View>
          ) : (
            <FlatList
              data={filteredEvents}
              keyExtractor={(event) => event.id}
              renderItem={({ item }) => (
                <EventDiscoveryCard
                  event={item}
                  variant="standard"
                  saved={isHydrated && isFavorite(item.id)}
                  onFavoritePress={() => toggleFavorite(item.id)}
                  testID={`events-event-${item.id}`}
                />
              )}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              testID="events-event-list"
            />
          )}
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  listContent: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
    gap: spacing.md,
  },
});
