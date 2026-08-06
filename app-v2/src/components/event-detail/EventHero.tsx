import { StyleProp, StyleSheet, View, ViewStyle, Pressable } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { IconButton } from '@/components/buttons/IconButton';
import { EventImage } from '@/components/discovery/EventImage';
import { EventStatusBadge, TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { TicketPriceLabel } from '@/components/discovery/TicketPriceLabel';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { EventHeroViewModel } from './view-models';

export interface EventHeroProps {
  event: EventHeroViewModel;
  saved?: boolean;
  showGenreLabels?: boolean;
  onImagePress?: () => void;
  onBackPress?: () => void;
  onSharePress?: () => void;
  onSavePress?: () => void;
  onMorePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockup 11 event detail hero — image, metadata, and flat overlay actions. */
export function EventHero({
  event,
  saved = false,
  showGenreLabels = true,
  onImagePress,
  onBackPress,
  onSharePress,
  onSavePress,
  onMorePress,
  style,
  testID,
}: EventHeroProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View style={styles.heroFrame}>
        <Pressable
          onPress={onImagePress}
          disabled={!onImagePress}
          accessibilityRole={onImagePress ? 'button' : undefined}
          accessibilityLabel={onImagePress ? 'Flyer in Vollbild öffnen' : undefined}
        >
          <EventImage
            source={event.image}
            variant="hero"
            overlay={
              <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]} />
            }
          />
        </Pressable>
        <View style={styles.topActions}>
          {onBackPress ? (
            <IconButton icon="arrow-back" accessibilityLabel="Zurück" onPress={onBackPress} />
          ) : null}
          <View style={styles.trailingActions}>
            {onSharePress ? (
              <IconButton icon="share-outline" accessibilityLabel="Event teilen" onPress={onSharePress} />
            ) : null}
            {onSavePress ? (
              <FavoriteButton
                active={saved}
                onPress={onSavePress}
                accessibilityLabel={saved ? 'Aus Gespeichert entfernen' : 'Event speichern'}
              />
            ) : null}
            {onMorePress ? (
              <IconButton icon="ellipsis-vertical" accessibilityLabel="Weitere Aktionen" onPress={onMorePress} />
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.dateBadge,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radiusRoles.badge,
            },
          ]}
        >
          <AppText role="label">{event.dateLabel}</AppText>
          {event.weekdayLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary}>
              {event.weekdayLabel}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.copy}>
        <AppText role="caption" color={theme.colors.accent}>
          {(event.categoryLabel ?? event.genreLabels[0] ?? '').toUpperCase()}
        </AppText>
        <AppText role="titleLarge">{event.title}</AppText>
        <View style={styles.venueRow}>
          <AppIcon name="location" size="sm" colorRole="accent" />
          <AppText role="bodyMuted">
            {event.venueLabel}, {event.cityLabel}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          {showGenreLabels && event.attributeBadges && event.attributeBadges.length > 0 ? (
            <View style={styles.genreRow}>
              {event.attributeBadges.map((badge) => (
                <View
                  key={badge.id}
                  style={[
                    styles.genreTag,
                    {
                      backgroundColor: theme.colors.accentMuted,
                      borderRadius: theme.radiusRoles.badge,
                    },
                  ]}
                >
                  <AppText role="badge" color={theme.colors.textSecondary}>
                    {badge.label}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          {showGenreLabels && event.genreLabels.length > 0 ? (
            <View style={styles.genreRow}>
              {event.genreLabels.slice(0, 3).map((genre) => (
                <View
                  key={genre}
                  style={[
                    styles.genreTag,
                    {
                      backgroundColor: theme.colors.accentMuted,
                      borderRadius: theme.radiusRoles.badge,
                    },
                  ]}
                >
                  <AppText role="badge" color={theme.colors.accent}>
                    {genre}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          {event.ticketLabel ? (
            <TicketPriceLabel
              label={event.ticketLabel}
              colorToken={event.ticketColorToken}
            />
          ) : null}
        </View>
        <View style={styles.statusRow}>
          {event.timeLabel ? (
            <AppText role="metadata">
              {event.endTimeLabel ? `${event.timeLabel} – ${event.endTimeLabel}` : event.timeLabel}
            </AppText>
          ) : null}
          {event.status ? <EventStatusBadge status={event.status} /> : null}
          {event.ticketStatus ? <TicketStatusBadge status={event.ticketStatus} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  heroFrame: {
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.45,
  },
  topActions: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  dateBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  copy: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  genreTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
