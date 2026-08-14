import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EventImage } from '@/components/discovery/EventImage';
import { AppText } from '@/components/layout/AppText';
import { spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import type { EventDetail } from '@/features/events/types/event-core';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface EventDetailContentProps {
  detail: EventDetail;
  display: EventDisplayModel;
}

function GenreChip({ label }: { label: string }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.genreChip,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <AppText role="caption">{label}</AppText>
    </View>
  );
}

export function EventDetailContent({ detail, display }: EventDetailContentProps) {
  const { theme } = useTheme();
  const ticket = detail.tickets[0];

  return (
    <ScrollView contentContainerStyle={styles.content} testID="event-detail-content">
      <EventImage variant="hero" source={display.image} />

      <View style={styles.section}>
        <AppText role="titleLarge">{display.title}</AppText>
        <AppText role="body" style={styles.meta}>
          {display.date}
          {display.startTime ? ` · ${display.startTime}` : ''}
          {display.endTime ? ` – ${display.endTime}` : ''}
        </AppText>
        <AppText role="body" style={styles.meta}>
          {[display.venue, display.city].filter(Boolean).join(', ')}
        </AppText>
      </View>

      {display.description ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Beschreibung</AppText>
          <AppText role="body" style={styles.description}>
            {display.description}
          </AppText>
        </View>
      ) : null}

      {detail.lineup.length > 0 ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Line-up</AppText>
          {detail.lineup.map((act) => (
            <View key={act.id} style={styles.lineupRow}>
              <AppText role="body">{act.billingName}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {detail.genres.length > 0 ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Genres</AppText>
          <View style={styles.genreRow}>
            {detail.genres.map((genre) => (
              <GenreChip key={genre.id} label={genre.displayName} />
            ))}
          </View>
        </View>
      ) : null}

      {ticket ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Tickets</AppText>
          <AppText role="body">
            {display.priceText ?? 'Preis auf Anfrage'}
            {ticket.currency ? ` · ${ticket.currency}` : ''}
          </AppText>
          {ticket.salesStatus ? (
            <AppText role="caption" style={{ color: theme.colors.textMuted }}>
              Status: {ticket.salesStatus}
            </AppText>
          ) : null}
          {ticket.ticketUrl ? (
            <PrimaryButton
              label="Tickets öffnen"
              style={styles.ticketButton}
              onPress={() => {
                void Linking.openURL(ticket.ticketUrl!);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

export function EventDetailLoadingState() {
  const { theme } = useTheme();

  return (
    <View style={styles.loadingState} testID="event-detail-loading">
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacingRoles.listBottomInset,
    gap: spacingRoles.sectionGap,
  },
  section: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: 8,
  },
  meta: {
    marginTop: 4,
  },
  description: {
    marginTop: 8,
  },
  lineupRow: {
    marginTop: 8,
    gap: 2,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  genreChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ticketButton: {
    marginTop: 12,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingRoles.screenHorizontal,
  },
});
