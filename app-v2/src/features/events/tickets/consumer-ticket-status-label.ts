const CONSUMER_TICKET_STATUS_LABELS: Record<string, string> = {
  available: 'Verfügbar',
  on_sale: 'Verfügbar',
  low_availability: 'Wenige verfügbar',
  sold_out: 'Ausverkauft',
  sales_ended: 'Verkauf beendet',
  sale_not_started: 'Verkauf startet bald',
  cancelled: 'Abgesagt',
  registration_only: 'Registrierung',
  door_only: 'Nur Abendkasse',
  availability_unverified: 'Status unbekannt',
  provider_access_unavailable: 'Status unbekannt',
  presale_registration: 'Vorverkauf',
  unavailable_unknown: 'Status unbekannt',
};

const RAW_TICKET_STATUS_VALUES = new Set([
  'available',
  'on_sale',
  'low_availability',
  'sold_out',
  'sales_ended',
  'sale_not_started',
  'cancelled',
  'registration_only',
  'door_only',
  'availability_unverified',
  'provider_access_unavailable',
  'presale_registration',
  'unavailable_unknown',
]);

export function projectConsumerTicketStatusLabel(salesStatus: string | null | undefined): string | undefined {
  if (!salesStatus) {
    return undefined;
  }
  return CONSUMER_TICKET_STATUS_LABELS[salesStatus] ?? undefined;
}

export function isRawTicketStatusValue(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return RAW_TICKET_STATUS_VALUES.has(value.trim());
}

export function containsTechnicalProviderState(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /\bprovider_access_unavailable\b/i.test(value);
}
