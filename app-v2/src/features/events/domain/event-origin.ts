export const EVENT_ORIGIN_ROLES = [
  'official',
  'organizer',
  'venue',
  'festival',
  'promoter',
  'ticketing',
  'aggregator',
  'community',
] as const;

export type EventOriginRole = (typeof EVENT_ORIGIN_ROLES)[number];

export const EVENT_ORIGIN_SYNC_STATUSES = [
  'active',
  'stale',
  'unavailable',
  'blocked',
  'removed',
  'error',
] as const;

export type EventOriginSyncStatus = (typeof EVENT_ORIGIN_SYNC_STATUSES)[number];

export interface EventOrigin {
  id: string;
  eventId: string;
  sourceId: string;
  sourceType?: string;
  platform?: string;
  role: EventOriginRole;
  externalId: string;
  canonicalUrl?: string;
  eventUrl?: string;
  ticketUrl?: string;
  organizerExternalId?: string;
  checkoutProviderId?: string;
  discoveredAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSuccessfulSyncAt?: string;
  syncStatus: EventOriginSyncStatus;
  trustScore?: number;
  priority: number;
  isPrimary: boolean;
  isActive: boolean;
  rawMetadata?: Record<string, unknown>;
}

export function buildOriginStableKey(sourceId: string, externalId: string): string {
  return `${sourceId}:${externalId}`;
}

export function resolveOriginRole(input: {
  sourceType?: string;
  sourceRoles?: string[];
}): EventOriginRole {
  const roles = input.sourceRoles ?? [];
  if (roles.includes('ticketing') || input.sourceType === 'ticket_platform') {
    return 'ticketing';
  }
  if (roles.includes('organizer')) {
    return 'organizer';
  }
  if (roles.includes('festival')) {
    return 'festival';
  }
  if (roles.includes('club') || roles.includes('venue')) {
    return 'venue';
  }
  if (input.sourceType === 'website') {
    return 'official';
  }
  return 'aggregator';
}

export function resolvePlatformFromSource(input: {
  sourceType?: string;
  connectorKey?: string;
  sourceConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const ticketPlatform = input.sourceConfig?.ticketPlatform as { platform?: string } | undefined;
  if (ticketPlatform?.platform) {
    return ticketPlatform.platform;
  }
  if (typeof input.metadata?.platform === 'string') {
    return input.metadata.platform;
  }
  return input.connectorKey;
}
