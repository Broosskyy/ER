import { StyleSheet, View } from 'react-native';

import { EventCard } from '@/components/discovery/EventCard';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import type { EntityProfileEvents } from '@/features/events/domain/entity-profile-events-service';
import { toEventCardViewModel } from '@/features/events/formatting/event-card-view-model';
import { toEventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';

export interface EntityProfileEventsSectionProps {
  events: EntityProfileEvents;
  onEventPress: (eventId: string) => void;
}

function EventBucket({
  title,
  events,
  onEventPress,
}: {
  title: string;
  events: Event[];
  onEventPress: (eventId: string) => void;
}) {
  const { theme } = useTheme();

  if (events.length === 0) {
    return null;
  }

  return (
    <Section title={title}>
      <Stack gap="sm">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={toEventCardViewModel(toEventDisplayModel(event))}
            variant="compact"
            onPress={() => onEventPress(event.id)}
          />
        ))}
      </Stack>
      {events.some(
        (event) => event.cancelledAt || event.postponedAt,
      ) ? (
        <AppText role="caption" color={theme.colors.textSecondary} style={styles.notice}>
          Abgesagte oder verschobene Events sind gekennzeichnet.
        </AppText>
      ) : null}
    </Section>
  );
}

export function EntityProfileEventsSection({
  events,
  onEventPress,
}: EntityProfileEventsSectionProps) {
  const { theme } = useTheme();
  const total =
    events.upcoming.length + events.happeningNow.length + events.past.length;

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <AppText role="bodyMuted" color={theme.colors.textSecondary}>
          Noch keine Events für dieses Profil.
        </AppText>
      </View>
    );
  }

  return (
    <Stack gap="lg">
      <EventBucket title="Gerade live" events={events.happeningNow} onEventPress={onEventPress} />
      <EventBucket title="Kommende Events" events={events.upcoming} onEventPress={onEventPress} />
      <EventBucket title="Vergangene Events" events={events.past} onEventPress={onEventPress} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.lg,
  },
  notice: {
    marginTop: spacing.sm,
  },
});
