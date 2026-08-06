import { type ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { Card } from '@/components/cards/CardFoundation';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { EventImage } from './EventImage';
import { EventStatusBadge, TicketStatusBadge } from './EventStatusBadge';
import { TicketPriceLabel } from './TicketPriceLabel';
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

function buildFavoriteAction(saved: boolean, onFavoritePress?: () => void) {
  if (!onFavoritePress) {
    return null;
  }

  return (
    <FavoriteButton
      active={saved}
      onPress={onFavoritePress}
      accessibilityLabel={saved ? 'Aus Favoriten entfernen' : 'Event speichern'}
    />
  );
}

function wrapInteractive(
  content: ReactNode,
  options: {
    testID?: string;
    onPress?: () => void;
    accessibilityLabel: string;
    favoriteAction: ReactNode;
    actionsPlacement: 'overlay' | 'trailing';
    actionsStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
  },
) {
  const { testID, onPress, accessibilityLabel, favoriteAction, actionsPlacement, actionsStyle, style } =
    options;

  if (onPress) {
    return (
      <InteractiveCard
        testID={testID}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        actions={favoriteAction}
        actionsPlacement={actionsPlacement}
        actionsStyle={actionsStyle}
        pressableStyle={styles.pressable}
        pressedStyle={styles.pressed}
        style={style}
      >
        {content}
      </InteractiveCard>
    );
  }

  return (
    <View testID={testID} style={style}>
      {content}
      {favoriteAction}
    </View>
  );
}

/** Presentational event card for mockup-backed discovery layouts. */
export function EventCard({
  event,
  variant = 'standard',
  saved = false,
  onPress,
  onFavoritePress,
  style,
  testID,
}: EventCardProps) {
  if (variant === 'featuredHome') {
    return (
      <FeaturedHomeCard
        event={event}
        saved={saved}
        onPress={onPress}
        onFavoritePress={onFavoritePress}
        style={style}
        testID={testID}
      />
    );
  }

  if (variant === 'compactPremium') {
    return (
      <CompactPremiumCard
        event={event}
        saved={saved}
        onPress={onPress}
        onFavoritePress={onFavoritePress}
        style={style}
        testID={testID}
      />
    );
  }

  if (variant === 'verticalPremium') {
    return (
      <VerticalPremiumCard
        event={event}
        saved={saved}
        onPress={onPress}
        onFavoritePress={onFavoritePress}
        style={style}
        testID={testID}
      />
    );
  }

  return (
    <LegacyEventCard
      event={event}
      variant={variant}
      saved={saved}
      onPress={onPress}
      onFavoritePress={onFavoritePress}
      style={style}
      testID={testID}
    />
  );
}

function FeaturedHomeCard({
  event,
  saved,
  onPress,
  onFavoritePress,
  style,
  testID,
}: Omit<EventCardProps, 'variant'>) {
  const { theme } = useTheme();
  const favoriteAction = buildFavoriteAction(Boolean(saved), onFavoritePress);

  const imageOverlay = (
    <View
      style={[
        styles.dateBadgeBottom,
        {
          backgroundColor: theme.colors.overlay,
          borderRadius: theme.radiusRoles.badge,
        },
      ]}
    >
      <AppText role="caption" color={theme.colors.textOnPrimary}>
        {event.dateLabel}
      </AppText>
    </View>
  );

  const content = (
    <Card
      padding={false}
      style={[
        styles.card,
        styles.featuredHomeCard,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radiusRoles.card },
        style,
      ]}
    >
      <View style={styles.featuredContent}>
        <EventImage
          source={event.image}
          variant="featuredHome"
          overlay={imageOverlay}
          style={styles.featuredHomeImage}
        />

        <View style={[styles.featuredHomeDetails, { gap: spacing.xs }]}>
          <AppText role="caption" color={theme.colors.accent} numberOfLines={1}>
            {(event.categoryLabel ?? event.genreLabels[0] ?? '').toUpperCase()}
          </AppText>

          <AppText role="cardTitle" numberOfLines={2}>
            {event.title}
          </AppText>

          <View style={styles.venueRow}>
            <AppIcon name="location" size="sm" colorRole="accent" />
            <AppText role="cardSubtitle" color={theme.colors.textSecondary} numberOfLines={1}>
              {event.venueLabel}, {event.cityLabel}
            </AppText>
          </View>

          <View style={styles.footer}>
            <View style={styles.genreRow}>
              {event.genreLabels.slice(0, 2).map((genre) => (
                <View
                  key={genre}
                  style={[
                    styles.featuredHomeGenreTag,
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
            {event.ticketLabel ? (
              <TicketPriceLabel label={event.ticketLabel} colorToken={event.ticketColorToken} />
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );

  return wrapInteractive(content, {
    testID,
    onPress,
    accessibilityLabel: event.accessibilityLabel,
    favoriteAction,
    actionsPlacement: 'overlay',
    actionsStyle: styles.favoriteOverlayTopRight,
  });
}

function CompactPremiumCard({
  event,
  saved,
  onPress,
  onFavoritePress,
  style,
  testID,
}: Omit<EventCardProps, 'variant'>) {
  const { theme } = useTheme();
  const favoriteAction = buildFavoriteAction(Boolean(saved), onFavoritePress);
  const genreLine = event.genreLabels.slice(0, 2).join(' · ');

  const content = (
    <Card
      padding="md"
      style={[styles.card, styles.compactPremiumCard, { borderRadius: theme.radiusRoles.card }, style]}
    >
      <View style={styles.compactPremiumRow}>
        <EventImage source={event.image} variant="compactPremium" />

        <View style={styles.compactPremiumDetails}>
          {(event.status || event.ticketStatus) && (
            <View style={styles.statusRow}>
              {event.status ? <EventStatusBadge status={event.status} showIcon /> : null}
              {event.ticketStatus && event.ticketStatus !== 'sold_out' ? (
                <TicketStatusBadge status={event.ticketStatus} />
              ) : null}
            </View>
          )}
          <AppText role="cardTitle" numberOfLines={2}>
            {event.title}
          </AppText>

          <View style={styles.venueRow}>
            <AppIcon name="location" size="sm" colorRole="accent" />
            <AppText role="cardSubtitle" color={theme.colors.textSecondary} numberOfLines={1}>
              {event.venueLabel}, {event.cityLabel}
            </AppText>
          </View>

          {genreLine ? (
            <AppText role="caption" color={theme.colors.textMuted} numberOfLines={1}>
              {genreLine}
            </AppText>
          ) : null}

          {event.ticketLabel ? (
            <TicketPriceLabel label={event.ticketLabel} colorToken={event.ticketColorToken} />
          ) : null}
        </View>

        {event.timeLabel ? (
          <View style={styles.compactPremiumTime}>
            <AppText role="label" color={theme.colors.accent}>
              {event.timeLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );

  return wrapInteractive(content, {
    testID,
    onPress,
    accessibilityLabel: event.accessibilityLabel,
    favoriteAction,
    actionsPlacement: 'overlay',
    actionsStyle: styles.favoriteOverlayCompactPremium,
  });
}

function VerticalPremiumCard({
  event,
  saved,
  onPress,
  onFavoritePress,
  style,
  testID,
}: Omit<EventCardProps, 'variant'>) {
  const { theme } = useTheme();
  const favoriteAction = buildFavoriteAction(Boolean(saved), onFavoritePress);

  const imageOverlay = (
    <View
      style={[
        styles.dateBadgeBottom,
        {
          backgroundColor: theme.colors.overlay,
          borderRadius: theme.radiusRoles.badge,
        },
      ]}
    >
      {event.weekdayLabel ? (
        <AppText role="badge" color={theme.colors.textOnPrimary}>
          {event.weekdayLabel}
        </AppText>
      ) : null}
      <AppText role="caption" color={theme.colors.textOnPrimary}>
        {event.dateLabel}
      </AppText>
    </View>
  );

  const content = (
    <Card
      padding={false}
      style={[
        styles.card,
        styles.verticalPremiumCard,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radiusRoles.card },
        style,
      ]}
    >
      <EventImage
        source={event.image}
        variant="verticalPremium"
        overlay={imageOverlay}
        style={styles.verticalPremiumImage}
      />

      <View style={[styles.verticalPremiumBody, { gap: spacing.xs }]}>
        {(event.status || event.ticketStatus) && (
          <View style={styles.statusRow}>
            {event.status ? <EventStatusBadge status={event.status} showIcon /> : null}
            {event.ticketStatus ? <TicketStatusBadge status={event.ticketStatus} /> : null}
          </View>
        )}
        <AppText role="caption" color={theme.colors.accent} numberOfLines={1}>
          {(event.categoryLabel ?? event.genreLabels[0] ?? '').toUpperCase()}
        </AppText>

        <AppText role="cardTitle" numberOfLines={2}>
          {event.title}
        </AppText>

        <View style={styles.venueRow}>
          <AppIcon name="location" size="sm" colorRole="accent" />
          <AppText role="cardSubtitle" color={theme.colors.textSecondary} numberOfLines={1}>
            {event.venueLabel}, {event.cityLabel}
          </AppText>
        </View>

        {event.timeLabel ? (
          <AppText role="metadata" color={theme.colors.textMuted}>
            {event.timeLabel}
            {event.endTimeLabel ? ` – ${event.endTimeLabel}` : ''}
          </AppText>
        ) : null}

        {event.ticketLabel ? (
          <TicketPriceLabel label={event.ticketLabel} colorToken={event.ticketColorToken} />
        ) : null}
      </View>
    </Card>
  );

  return wrapInteractive(content, {
    testID,
    onPress,
    accessibilityLabel: event.accessibilityLabel,
    favoriteAction,
    actionsPlacement: 'overlay',
    actionsStyle: styles.favoriteOverlayTopRight,
  });
}

function LegacyEventCard({
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

  const imageOverlay = (
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
      {saved && isFeatured ? (
        <View style={styles.savedRibbon}>
          <AppIcon name="bookmark" size="md" colorRole="accent" />
        </View>
      ) : null}
    </>
  );

  const content = (
    <Card
      padding={false}
      elevated={variant === 'featured'}
      style={[styles.card, metrics.containerStyle, style]}
    >
      <View style={isFeatured ? styles.featuredContent : styles.rowContent}>
        <EventImage source={event.image} variant={metrics.imageVariant} overlay={imageOverlay} />

        <View style={[styles.details, { gap: metrics.contentGap }]}>
          <AppText role="caption" color={theme.colors.accent} numberOfLines={1}>
            {(event.categoryLabel ?? event.genreLabels[0] ?? '').toUpperCase()}
          </AppText>

          <AppText role="cardTitle" numberOfLines={2}>
            {event.title}
          </AppText>

          <View style={styles.venueRow}>
            <AppIcon name="location" size="sm" colorRole="accent" />
            <AppText role="cardSubtitle" color={theme.colors.textSecondary} numberOfLines={1}>
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
                  <TicketPriceLabel label={event.ticketLabel} colorToken={event.ticketColorToken} />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );

  const favoriteAction = buildFavoriteAction(Boolean(saved), onFavoritePress);
  const actionsPlacement = variant === 'featured' ? 'overlay' : 'trailing';
  const favoriteStyle =
    variant === 'featured' ? styles.favoriteOverlayTopRight : styles.favoriteActionTrailing;

  return wrapInteractive(content, {
    testID,
    onPress,
    accessibilityLabel: event.accessibilityLabel,
    favoriteAction,
    actionsPlacement,
    actionsStyle: favoriteStyle,
  });
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.88,
  },
  favoriteOverlayTopRight: {
    top: spacing.sm,
    right: spacing.sm,
    bottom: undefined,
    left: undefined,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  favoriteOverlayCompactPremium: {
    top: spacing.sm,
    right: spacing.sm,
    bottom: undefined,
    left: undefined,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  favoriteActionTrailing: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingRight: spacing.sm,
    paddingLeft: spacing.xs,
  },
  card: {
    overflow: 'hidden',
  },
  featuredHomeCard: {
    borderWidth: 0,
  },
  featuredHomeImage: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  compactPremiumCard: {
    overflow: 'visible',
  },
  compactPremiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  compactPremiumDetails: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  compactPremiumTime: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 48,
  },
  verticalPremiumCard: {
    borderWidth: 0,
  },
  verticalPremiumImage: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  verticalPremiumBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  rowContent: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  featuredContent: {
    gap: 0,
  },
  details: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  featuredHomeDetails: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dateBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  dateBadgeBottom: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'flex-start',
    gap: 2,
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  featuredHomePrice: {
    marginLeft: 'auto',
    fontWeight: '600',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  genreTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  featuredHomeGenreTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  statusArea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
