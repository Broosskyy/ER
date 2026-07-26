import { Image, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { componentSize } from '@/design/layout';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { TicketCardViewModel } from './view-models';

export type TicketCardVariant = 'available' | 'purchased' | 'compact';

export interface TicketCardProps {
  ticket: TicketCardViewModel;
  variant?: TicketCardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** My Tickets card derived from mockups 16, 17 and the ticket card in mockup 54. */
export function TicketCard({
  ticket,
  variant = 'purchased',
  onPress,
  style,
  testID,
}: TicketCardProps) {
  const { theme } = useTheme();
  const compact = variant === 'compact';
  const content = (
    <CardFoundation padding={false} style={[styles.card, style]} testID={testID}>
      <View style={[styles.eventRow, compact && styles.compactRow]}>
        {ticket.eventImage ? (
          <Image source={ticket.eventImage} accessibilityIgnoresInvertColors style={[styles.image, compact && styles.compactImage]} />
        ) : (
          <View style={[styles.imageFallback, compact && styles.compactImage, { backgroundColor: theme.colors.surfaceSubtle }]}>
            <AppIcon name="ticket-outline" color={theme.colors.accent} />
          </View>
        )}
        <View style={styles.eventContent}>
          <View style={styles.topline}>
            {ticket.categoryLabel ? <AppText role="badge" color={theme.colors.accent}>{ticket.categoryLabel}</AppText> : null}
            <TicketStatusBadge status={ticket.status} />
          </View>
          <AppText role="cardTitle" numberOfLines={compact ? 1 : 2}>{ticket.eventTitle}</AppText>
          {!compact ? (
            <View style={styles.meta}>
              <TicketMeta icon="calendar-outline" label={ticket.dateLabel} />
              {ticket.timeLabel ? <TicketMeta icon="time-outline" label={ticket.timeLabel} /> : null}
              <TicketMeta icon="location-outline" label={`${ticket.venueLabel} · ${ticket.cityLabel}`} />
            </View>
          ) : null}
        </View>
      </View>
      {!compact ? (
        <View style={[styles.ticketFooter, { borderTopColor: theme.colors.borderSubtle }]}>
          <View style={styles.footerCopy}>
            <AppText role="bodyStrong">{ticket.ticketTypeLabel}</AppText>
            <AppText role="caption" color={theme.colors.textSecondary}>{ticket.priceLabel}{ticket.seatOrZoneLabel ? ` · ${ticket.seatOrZoneLabel}` : ''}</AppText>
            {ticket.purchaserName ? <AppText role="caption" color={theme.colors.textSecondary}>{ticket.purchaserName}</AppText> : null}
          </View>
          {variant === 'purchased' && ticket.qrHintLabel ? (
            <View style={[styles.qrHint, { borderColor: theme.colors.accentMuted }]}>
              <AppIcon name="qr-code-outline" size="sm" color={theme.colors.accent} />
              <AppText role="caption" color={theme.colors.accent}>{ticket.qrHintLabel}</AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </CardFoundation>
  );

  if (!onPress) {
    return <View accessibilityLabel={ticket.accessibilityLabel}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={ticket.accessibilityLabel} onPress={onPress}>
      {content}
    </Pressable>
  );
}

function TicketMeta({ icon, label }: { icon: 'calendar-outline' | 'time-outline' | 'location-outline'; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.metaRow}>
      <AppIcon name={icon} size="sm" color={theme.colors.textMuted} />
      <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', gap: 0 },
  eventRow: { flexDirection: 'row', minHeight: componentSize.ticketCardMinHeight },
  compactRow: { minHeight: componentSize.eventListRowMinHeight },
  image: { width: componentSize.ticketCardImageWidth, alignSelf: 'stretch' },
  compactImage: { width: componentSize.ticketCardCompactImageWidth, minHeight: componentSize.eventListRowMinHeight },
  imageFallback: { width: componentSize.ticketCardImageWidth, alignItems: 'center', justifyContent: 'center' },
  eventContent: { flex: 1, gap: spacing.sm, padding: spacing.md },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  meta: { gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: borderWidth.hairline,
  },
  footerCopy: { flex: 1, gap: spacing.xs },
  qrHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: borderWidth.hairline,
    borderRadius: radii.sm,
  },
});
