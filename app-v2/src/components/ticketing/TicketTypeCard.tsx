import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { AppText } from '@/components/layout/AppText';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { TicketTypeViewModel } from './view-models';

export interface TicketTypeCardProps {
  ticketType: TicketTypeViewModel;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Ticket product selector with UI-only availability and already-calculated fee labels. */
export function TicketTypeCard({
  ticketType,
  selected = false,
  onPress,
  style,
  testID,
}: TicketTypeCardProps) {
  const { theme } = useTheme();
  const disabled = ticketType.status !== 'available';
  const content = (
    <CardFoundation
      padding="md"
      style={[
        styles.card,
        { borderColor: selected ? theme.colors.accent : theme.colors.borderSubtle },
        disabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText role="cardTitle">{ticketType.name}</AppText>
          {ticketType.description ? <AppText role="bodyMuted">{ticketType.description}</AppText> : null}
        </View>
        <View style={styles.price}>
          <AppText role="bodyStrong">{ticketType.priceLabel}</AppText>
          {ticketType.status !== 'available' ? <TicketStatusBadge status={ticketType.status} /> : null}
        </View>
      </View>
      {ticketType.availabilityLabel ? <AppText role="caption" color={theme.colors.textSecondary}>{ticketType.availabilityLabel}</AppText> : null}
      {ticketType.salesPeriodLabel ? <AppText role="caption" color={theme.colors.textSecondary}>{ticketType.salesPeriodLabel}</AppText> : null}
      {ticketType.remainingLabel ? <AppText role="caption" color={theme.colors.warning}>{ticketType.remainingLabel}</AppText> : null}
      {ticketType.serviceFeeLabel ? (
        <View style={[styles.fee, { backgroundColor: theme.colors.surfaceSubtle }]}>
          <AppText role="caption" color={theme.colors.textSecondary}>{ticketType.serviceFeeLabel}</AppText>
        </View>
      ) : null}
    </CardFoundation>
  );

  if (!onPress) return <View accessibilityLabel={ticketType.accessibilityLabel}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ticketType.accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  disabled: { opacity: 0.55 },
  header: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  copy: { flex: 1, gap: spacing.xs },
  price: { alignItems: 'flex-end', gap: spacing.xs },
  fee: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
