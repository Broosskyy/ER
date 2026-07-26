import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { TicketSummaryViewModel } from './view-models';

export interface TicketSummaryProps {
  summary: TicketSummaryViewModel;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Display-only price summary. Amount formatting and fee calculation remain with the caller. */
export function TicketSummary({ summary, style, testID }: TicketSummaryProps) {
  const { theme } = useTheme();
  return (
    <CardFoundation padding="md" style={[styles.card, style]} testID={testID}>
      <View accessibilityLabel={summary.accessibilityLabel}>
        <SummaryRow label="Zwischensumme" value={summary.subtotalLabel} />
        {summary.serviceFeeLabel ? <SummaryRow label="Servicegebühr" value={summary.serviceFeeLabel} /> : null}
        {summary.additionalFees?.map((fee) => <SummaryRow key={fee.id} label={fee.label} value={fee.valueLabel} />)}
        <View style={[styles.total, { borderTopColor: theme.colors.borderSubtle }]}>
          <AppText role="bodyStrong">Gesamt</AppText>
          <AppText role="bodyStrong">{summary.totalLabel}</AppText>
        </View>
      </View>
    </CardFoundation>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <AppText role="bodyMuted">{label}</AppText>
      <AppText role="body" color={theme.colors.textPrimary}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
  },
});
