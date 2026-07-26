import type { AppIconName } from '@/components/primitives/AppIcon';
import type { BadgeStatus } from '@/components/feedback/badge-styles';

import type { EventStatus, EventTicketStatus } from './view-models';

export interface ResolvedEventStatus {
  label: string;
  badgeStatus: BadgeStatus;
  icon: AppIconName;
}

const eventStatusStyles: Record<EventStatus, ResolvedEventStatus> = {
  upcoming: { label: 'Bald', badgeStatus: 'info', icon: 'time-outline' },
  today: { label: 'Heute', badgeStatus: 'success', icon: 'ellipse' },
  sold_out: { label: 'Ausverkauft', badgeStatus: 'error', icon: 'close-circle' },
  cancelled: { label: 'Abgesagt', badgeStatus: 'error', icon: 'ban' },
  postponed: { label: 'Verschoben', badgeStatus: 'warning', icon: 'time' },
  draft: { label: 'Entwurf', badgeStatus: 'default', icon: 'document-text-outline' },
  pending_review: { label: 'In Prüfung', badgeStatus: 'warning', icon: 'hourglass-outline' },
  verified: { label: 'Verifiziert', badgeStatus: 'success', icon: 'checkmark-circle' },
  unverified: { label: 'Nicht verifiziert', badgeStatus: 'default', icon: 'help-circle-outline' },
};

const ticketStatusStyles: Record<EventTicketStatus, ResolvedEventStatus> = {
  available: { label: 'Tickets verfügbar', badgeStatus: 'info', icon: 'ticket-outline' },
  free: { label: 'Kostenlos', badgeStatus: 'success', icon: 'gift-outline' },
  limited: { label: 'Limitiert', badgeStatus: 'warning', icon: 'pricetag-outline' },
  reserved: { label: 'Reserviert', badgeStatus: 'warning', icon: 'time-outline' },
  paid: { label: 'Bezahlt', badgeStatus: 'success', icon: 'checkmark-circle-outline' },
  valid: { label: 'Gültig', badgeStatus: 'success', icon: 'checkmark-circle' },
  used: { label: 'Verwendet', badgeStatus: 'default', icon: 'checkmark-done-outline' },
  cancelled: { label: 'Storniert', badgeStatus: 'error', icon: 'close-circle-outline' },
  refunded: { label: 'Erstattet', badgeStatus: 'info', icon: 'return-down-back-outline' },
  expired: { label: 'Abgelaufen', badgeStatus: 'default', icon: 'time-outline' },
  sold_out: { label: 'Ausverkauft', badgeStatus: 'error', icon: 'close-circle' },
  unavailable: { label: 'Nicht verfügbar', badgeStatus: 'default', icon: 'remove-circle-outline' },
};

export function resolveEventStatus(status: EventStatus): ResolvedEventStatus {
  return eventStatusStyles[status];
}

export function resolveTicketStatus(status: EventTicketStatus): ResolvedEventStatus {
  return ticketStatusStyles[status];
}
