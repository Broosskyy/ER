import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { EventImage } from '@/components/discovery/EventImage';
import { AppText } from '@/components/layout/AppText';
import { spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import type { EventDetail } from '@/features/events/types/event-core';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { buildEventDetailVisibleSurface } from '@/features/event-detail/event-detail-visible-surface';

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
  const surface = buildEventDetailVisibleSurface(detail, display);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="event-detail-content">
      <EventImage variant="hero" source={display.image} />

      <View style={styles.section}>
        <AppText role="titleLarge">{surface.title}</AppText>
        <AppText role="body" style={styles.meta}>
          {display.date}
          {display.startTime ? ` · ${display.startTime}` : ''}
          {display.endTime ? ` – ${display.endTime}` : ''}
        </AppText>
        <AppText role="body" style={styles.meta}>
          {surface.venueLine}
        </AppText>
      </View>

      {surface.description ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Beschreibung</AppText>
          <AppText role="body" style={styles.description}>
            {surface.description}
          </AppText>
        </View>
      ) : null}

      {surface.lineup.length > 0 ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Line-up</AppText>
          {surface.lineup.map((billingName, index) => (
            <View key={`${index}:${billingName}`} style={styles.lineupRow}>
              <AppText role="body">{billingName}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {surface.genres.length > 0 ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Genres</AppText>
          <View style={styles.genreRow}>
            {surface.genres.map((label) => (
              <GenreChip key={label} label={label} />
            ))}
          </View>
        </View>
      ) : null}

      {detail.tickets[0] ? (
        <View style={styles.section}>
          <AppText role="titleSmall">Tickets</AppText>
          {surface.priceText ? <AppText role="body">{surface.priceText}</AppText> : null}
          {surface.ticketBadgeStatus ? (
            <TicketStatusBadge status={surface.ticketBadgeStatus} />
          ) : surface.statusLabel ? (
            <AppText role="caption" style={{ color: theme.colors.textMuted }}>
              {surface.statusLabel}
            </AppText>
          ) : null}
          {surface.purchaseCtaLabel && surface.ticketCtaUrl ? (
            <PrimaryButton
              label={surface.purchaseCtaLabel}
              style={styles.ticketButton}
              onPress={() => {
                void Linking.openURL(surface.ticketCtaUrl!);
              }}
            />
          ) : null}
          {surface.presaleCtaLabel && surface.ticketCtaUrl ? (
            <PrimaryButton
              label={surface.presaleCtaLabel}
              style={styles.ticketButton}
              onPress={() => {
                void Linking.openURL(surface.ticketCtaUrl!);
              }}
            />
          ) : null}
        </View>
      ) : null}

      {display.visibleSources && display.visibleSources.length > 0 ? (
        <View style={styles.section} testID="event-source-section">
          <AppText role="titleSmall">Quellen</AppText>
          {display.visibleSources.map((source) => (
            <Pressable
              key={`${source.role}:${source.url}`}
              accessibilityRole="link"
              accessibilityLabel={source.label}
              testID={
                source.role === 'official_event' ? 'event-official-source-link' : 'event-social-source-link'
              }
              onPress={() => {
                void Linking.openURL(source.url);
              }}
            >
              <AppText role="body" style={{ color: theme.colors.primary }}>
                {source.label} ↗
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {surface.organizerName || (display.organizerLinks && display.organizerLinks.length > 0) ? (
        <View style={styles.section} testID="event-organizer-section">
          <AppText role="titleSmall">Veranstalter</AppText>
          {surface.organizerName ? <AppText role="body">{surface.organizerName}</AppText> : null}
          {(display.organizerLinks ?? []).map((link) => (
            <Pressable
              key={`${link.role}:${link.url}`}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              testID={
                link.role === 'organizer_website'
                  ? 'event-organizer-website-link'
                  : link.role === 'organizer_social'
                    ? 'event-organizer-social-link'
                    : 'event-organizer-link'
              }
              onPress={() => {
                void Linking.openURL(link.url);
              }}
            >
              <AppText role="body" style={{ color: theme.colors.primary }}>
                {link.label} ↗
              </AppText>
            </Pressable>
          ))}
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
