import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { EventCard } from '@/components/discovery/EventCard';
import { EventListItem } from '@/components/discovery/EventListItem';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Section } from '@/components/layout/Section';
import { TextButton } from '@/components/buttons/TextButton';
import { spacing } from '@/design/spacing';

import type { SimilarEventsViewModel } from './view-models';

export interface SimilarEventsSectionProps {
  similar: SimilarEventsViewModel;
  layout?: 'cards' | 'list';
  loading?: boolean;
  onEventPress?: (id: string) => void;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Similar events presentation — no recommendation logic. */
export function SimilarEventsSection({
  similar,
  layout = 'cards',
  loading = false,
  onEventPress,
  onActionPress,
  style,
  testID,
}: SimilarEventsSectionProps) {
  if (loading) {
    return (
      <Section title={similar.title ?? 'Ähnliche Events'} style={style} testID={testID}>
        <Skeleton shape="card" height={180} />
        <Skeleton shape="card" height={180} />
      </Section>
    );
  }

  if (similar.events.length === 0) {
    return (
      <Section title={similar.title ?? 'Ähnliche Events'} style={style} testID={testID}>
        <EmptyState title="Keine ähnlichen Events" icon="calendar-outline" />
      </Section>
    );
  }

  return (
    <Section
      title={similar.title ?? 'Ähnliche Events'}
      style={style}
      testID={testID}
    >
      {similar.actionLabel && onActionPress ? (
        <TextButton label={similar.actionLabel} onPress={onActionPress} />
      ) : null}
      {layout === 'cards' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {similar.events.map((event) => (
            <View key={event.id} style={styles.cardItem}>
              <EventCard event={event} onPress={() => onEventPress?.(event.id)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.list}>
          {similar.events.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              onPress={() => onEventPress?.(event.id)}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  cardItem: {
    width: 280,
  },
  list: {
    gap: spacing.sm,
  },
});
