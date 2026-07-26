import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { Card } from '@/components/cards/CardFoundation';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { EventImage } from './EventImage';
import { EventStatusBadge, TicketStatusBadge } from './EventStatusBadge';
import { resolveEventCardMetrics, type EventCardVariant } from './event-card-styles';
import type { EventCardViewModel } from './view-models';

export interface EventCardProps {
  event: EventCardViewModel;
  variant?: EventCardVariant;
  saved?: boolean;
  onPress?: () => void;
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Presentational event card for mockup-backed standard, featured, and compact states.
 * Navigation and favorite persistence remain with the parent.
 */
export function EventCard({
  event,
  variant = 'standard',
  saved = false,
  onPress,
  onFavoritePress,
  style,
  testID,
}: EventCardProps) {
  const { theme } = useTheme();
  const metrics = resolveEventCardMetrics(variant);
  const isFeatured = variant === 'featured';

  const content = (
    <Card padding={false} elevated={isFeatured} style={[styles.card, metrics.containerStyle, style]}>
      <View style={isFeatured ? styles.featuredContent : styles.rowContent}>
        <EventImage
          source={event.image}
          variant={metrics.imageVariant}
          overlay={
            <>
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
              {saved ? (
                <View style={styles.savedRibbon}>
                  <AppIcon name="bookmark" size="md" colorRole="accent" />
                </View>
              ) : null}
            </>
          }
        />

        <View style={[styles.details, { gap: metrics.contentGap }]}>
          <View style={styles.topMeta}>
            <AppText role="caption" color={theme.colors.accent} numberOfLines={1}>
              {(event.categoryLabel ?? event.genreLabels[0] ?? '').toUpperCase()}
            </AppText>
            {event.timeLabel ? <AppText role="metadata">{event.timeLabel}</AppText> : null}
          </View>

          <AppText role="cardTitle" numberOfLines={variant === 'compact' ? 1 : 2}>
            {event.title}
          </AppText>

          <View style={styles.venueRow}>
            <AppIcon name="location" size="sm" colorRole="accent" />
            <AppText role="cardSubtitle" numberOfLines={1}>
              {event.venueLabel}, {event.cityLabel}
            </AppText>
          </View>

          {variant !== 'compact' ? (
            <View style={styles.footer}>
              <View style={styles.genreRow}>
                {event.genreLabels.slice(0, 2).map((genre) => (
                  <View
                    key={genre}
                    style={[
                      styles.genreTag,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
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
              <View style={styles.statusArea}>
                {event.status ? <EventStatusBadge status={event.status} /> : null}
                {event.ticketStatus ? <TicketStatusBadge status={event.ticketStatus} /> : null}
                {event.ticketLabel ? (
                  <AppText role="metadata" color={theme.colors.success}>
                    {event.ticketLabel}
                  </AppText>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );

  const favoriteAction = onFavoritePress ? (
    <FavoriteButton
      active={saved}
      onPress={onFavoritePress}
      accessibilityLabel={saved ? 'Remove from saved events' : 'Save event'}
    />
  ) : null;

  if (onPress) {
    return (
      <InteractiveCard
      testID={testID}
      onPress={onPress}
      accessibilityLabel={event.accessibilityLabel}
      actions={favoriteAction}
      actionsStyle={styles.favoriteAction}
      pressableStyle={styles.pressable}
      pressedStyle={styles.pressed}
    >
        {content}
      </InteractiveCard>
    );
  }

  return <View testID={testID}>{content}{favoriteAction}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.88,
  },
  favoriteAction: {
    top: spacing.md,
    right: spacing.md,
    bottom: undefined,
    left: undefined,
  },
  card: {
    overflow: 'hidden',
  },
  rowContent: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  featuredContent: {
    gap: spacing.md,
  },
  details: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  topMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dateBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  savedRibbon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  genreTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusArea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
