import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';

/** Bumped when ticket-platform normalization/publish semantics change. */
export const TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION = '4.6.6';

export function isTicketPlatformSourceContext(input: {
  connectorKey?: string;
  sourceType?: string;
  platform?: string;
}): boolean {
  if (input.connectorKey === 'ticket_platform') {
    return true;
  }
  if (input.sourceType === 'ticket_platform') {
    return true;
  }
  const platform = input.platform?.toLowerCase();
  return platform === 'ticket_io' || platform === 'ticket_king' || platform === 'ticket_kings';
}

export function readTicketPlatformContextFromMetadata(
  metadata: Record<string, unknown> | undefined,
): { connectorKey?: string; platform?: string } {
  return {
    connectorKey: typeof metadata?.connector === 'string' ? metadata.connector : undefined,
    platform: typeof metadata?.platform === 'string' ? metadata.platform : undefined,
  };
}

export function isRepairablePlaceholderText(value: string | undefined): boolean {
  return !hasMeaningfulEventValue(value);
}

export function resolveFillOnlyText(
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (hasMeaningfulEventValue(incoming) && !hasMeaningfulEventValue(existing)) {
    return incoming;
  }
  return existing;
}

export function eventNeedsTicketPlatformFieldRepair(
  event: AdminEventRecord | null | undefined,
  context?: { connectorKey?: string; sourceType?: string; platform?: string },
): boolean {
  if (!event || !isTicketPlatformSourceContext(context ?? {})) {
    return false;
  }
  if (isRepairablePlaceholderText(event.description)) {
    return true;
  }
  if (!event.priceText?.trim()) {
    return true;
  }
  return false;
}

export function candidateCanRepairTicketPlatformEvent(
  candidate: CanonicalImportEvent,
  event: AdminEventRecord | null | undefined,
  context?: { connectorKey?: string; sourceType?: string; platform?: string },
): boolean {
  if (!event || !isTicketPlatformSourceContext(context ?? {})) {
    return false;
  }
  if (isRepairablePlaceholderText(event.description) && candidate.description?.trim()) {
    return true;
  }
  if (!event.priceText?.trim() && candidate.priceText?.trim()) {
    return true;
  }
  const structuredLineup = sanitizeLineupArtistNames(candidate.artistNames ?? []) ?? [];
  if (structuredLineup.length > 0 && !event.artistId) {
    return true;
  }
  return false;
}

export function repairVersionChanged(
  recordRepairVersion: unknown,
  candidateRepairVersion: unknown,
): boolean {
  if (typeof candidateRepairVersion !== 'string' || candidateRepairVersion.length === 0) {
    return false;
  }
  return recordRepairVersion !== candidateRepairVersion;
}
