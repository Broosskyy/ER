import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Banner } from '@/components/feedback/Banner';
import { TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { TicketSummary } from '@/components/ticketing/TicketSummary';
import { TicketTypeCard } from '@/components/ticketing/TicketTypeCard';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { EventTicketSectionViewModel } from './view-models';

export interface EventTicketSectionProps {
  section: EventTicketSectionViewModel;
  onCtaPress?: () => void;
  onTicketTypePress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockup 11 ticket block — composes ticketing components without checkout logic. */
export function EventTicketSection({
  section,
  onCtaPress,
  onTicketTypePress,
  style,
  testID,
}: EventTicketSectionProps) {
  const { theme } = useTheme();
  const disabled = section.mode === 'sold_out' || section.mode === 'unavailable';

  return (
    <Section title="Tickets" style={style} testID={testID}>
      <Stack gap="md">
        {section.noticeLabel ? <Banner title={section.noticeLabel} variant="warning" /> : null}
        {section.salesStartLabel ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            Verkaufsstart: {section.salesStartLabel}
          </AppText>
        ) : null}
        {section.salesEndLabel ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            Verkauf bis: {section.salesEndLabel}
          </AppText>
        ) : null}
        {section.mode === 'external' && section.externalUrlLabel ? (
          <AppText role="bodyMuted">Tickets extern über {section.externalUrlLabel}</AppText>
        ) : null}
        {section.mode === 'free_rsvp' ? <TicketStatusBadge status="free" /> : null}
        {section.ticketTypes.map((ticketType) => (
          <TicketTypeCard
            key={ticketType.id}
            ticketType={ticketType}
            onPress={onTicketTypePress ? () => onTicketTypePress(ticketType.id) : undefined}
          />
        ))}
        {section.summary ? <TicketSummary summary={section.summary} /> : null}
        <PrimaryButton
          label={section.ctaLabel}
          onPress={onCtaPress}
          disabled={disabled}
        />
      </Stack>
    </Section>
  );
}
