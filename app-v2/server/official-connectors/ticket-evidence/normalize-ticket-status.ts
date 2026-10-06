import type { NormalizedTicketStatus, VerifiedTicketStatus } from './types';

export interface NormalizedTicketStatusResult {
  status: VerifiedTicketStatus;
  normalizedStatus: NormalizedTicketStatus | 'registration_only' | 'free' | 'unavailable_unknown';
  rawStatus: string;
  confidence: number;
}

const SOLD_OUT_PATTERN = /\b(?:sold\s*out|ausverkauft|soldout)\b/i;
const SALE_NOT_STARTED_PATTERN = /\b(?:sale\s+starts|verkaufsstart|presale\s+starts|not\s+on\s+sale\s+yet)\b/i;
const SALES_ENDED_PATTERN = /\b(?:sales?\s+ended|verkauf\s+beendet|sale\s+closed)\b/i;
const CANCELLED_PATTERN = /\b(?:cancelled|canceled|abgesagt)\b/i;
const REGISTRATION_PATTERN = /\b(?:registration\s+only|register\s+only|nur\s+anmeldung)\b/i;
const FREE_PATTERN = /\b(?:free\s+entry|kostenlos|free\s+admission|eintritt\s+frei)\b/i;
const AVAILABLE_PATTERN =
  /\b(?:available|buy\s+ticket|tickets?\s+buy|jetzt\s+kaufen|add\s+to\s+cart|in\s+den\s+warenkorb|instock|in\s*stock)\b/i;

export function normalizeTicketStatusFromText(rawText: string): NormalizedTicketStatusResult {
  const rawStatus = rawText.replace(/\s+/g, ' ').trim();
  if (!rawStatus) {
    return { status: 'unavailable_unknown', normalizedStatus: 'unavailable_unknown', rawStatus, confidence: 0.2 };
  }
  if (SOLD_OUT_PATTERN.test(rawStatus)) {
    return { status: 'sold_out', normalizedStatus: 'sold_out', rawStatus, confidence: 0.95 };
  }
  if (SALE_NOT_STARTED_PATTERN.test(rawStatus)) {
    return { status: 'sale_not_started', normalizedStatus: 'sale_not_started', rawStatus, confidence: 0.9 };
  }
  if (SALES_ENDED_PATTERN.test(rawStatus)) {
    return { status: 'sales_ended', normalizedStatus: 'sales_ended', rawStatus, confidence: 0.9 };
  }
  if (CANCELLED_PATTERN.test(rawStatus)) {
    return { status: 'cancelled', normalizedStatus: 'cancelled', rawStatus, confidence: 0.95 };
  }
  if (REGISTRATION_PATTERN.test(rawStatus)) {
    return { status: 'registration_only', normalizedStatus: 'registration_only', rawStatus, confidence: 0.85 };
  }
  if (FREE_PATTERN.test(rawStatus)) {
    return { status: 'free', normalizedStatus: 'available', rawStatus, confidence: 0.9 };
  }
  if (AVAILABLE_PATTERN.test(rawStatus)) {
    return { status: 'available', normalizedStatus: 'available', rawStatus, confidence: 0.85 };
  }
  return { status: 'unavailable_unknown', normalizedStatus: 'unavailable_unknown', rawStatus, confidence: 0.4 };
}

export function toConsumerNormalizedStatus(
  status: VerifiedTicketStatus,
): NormalizedTicketStatus | undefined {
  switch (status) {
    case 'available':
    case 'free':
      return 'available';
    case 'sale_not_started':
      return 'sale_not_started';
    case 'sold_out':
      return 'sold_out';
    case 'sales_ended':
      return 'sales_ended';
    case 'cancelled':
      return 'cancelled';
    default:
      return undefined;
  }
}

export function classificationForStatus(status: VerifiedTicketStatus): string {
  switch (status) {
    case 'available':
      return 'verified_ticket_available';
    case 'sold_out':
      return 'verified_ticket_sold_out';
    case 'sale_not_started':
      return 'verified_sale_not_started';
    case 'sales_ended':
      return 'verified_sales_ended';
    case 'free':
      return 'verified_ticket_free';
    case 'registration_only':
      return 'verified_registration_only';
    default:
      return 'ticket_status_ambiguous';
  }
}
