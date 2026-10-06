import type { ImageSourcePropType } from 'react-native';

/**
 * UI-only models for ticket presentation. Parents provide all formatted labels
 * and never pass checkout, order, inventory, or fee-calculation concerns here.
 */
export type TicketCardStatus =
  | 'available'
  | 'reserved'
  | 'paid'
  | 'valid'
  | 'used'
  | 'cancelled'
  | 'refunded'
  | 'expired'
  | 'sold_out'
  | 'unavailable';

export interface TicketCardViewModel {
  id: string;
  eventTitle: string;
  eventImage?: ImageSourcePropType;
  categoryLabel?: string;
  dateLabel: string;
  timeLabel?: string;
  venueLabel: string;
  cityLabel: string;
  ticketTypeLabel: string;
  priceLabel: string;
  status: TicketCardStatus;
  ticketIdLabel?: string;
  purchaserName?: string;
  seatOrZoneLabel?: string;
  qrHintLabel?: string;
  accessibilityLabel: string;
}

export interface TicketTypeViewModel {
  id: string;
  name: string;
  description?: string;
  priceLabel: string;
  availabilityLabel?: string;
  salesPeriodLabel?: string;
  remainingLabel?: string;
  serviceFeeLabel?: string;
  status: 'available' | 'sold_out' | 'unavailable';
  accessibilityLabel: string;
}

export interface TicketSummaryLineItem {
  id: string;
  label: string;
  valueLabel: string;
}

export interface TicketSummaryViewModel {
  subtotalLabel: string;
  serviceFeeLabel?: string;
  additionalFees?: TicketSummaryLineItem[];
  totalLabel: string;
  accessibilityLabel: string;
}
