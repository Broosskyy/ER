import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { isTicketIoPlaceholderDescription } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import {
  candidateCanRepairTicketPlatformEvent,
  eventNeedsTicketPlatformFieldRepair,
  isRepairablePlaceholderText,
  repairVersionChanged,
  resolveFillOnlyText,
  TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION,
} from '@/features/import/services/ticket-platform-field-repair';

/** @deprecated Use TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION */
export const TICKET_IO_DATA_QUALITY_REPAIR_VERSION = TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION;

/** @deprecated Source IDs belong in source registry — use connectorKey ticket_platform. */
export const TICKET_IO_MANAGED_SOURCE_IDS = new Set<string>();

/** @deprecated Enrichment is multi-origin — resolved via field-trust merge. */
export function isTicketIoManagedSource(_sourceId: string | undefined): boolean {
  return false;
}

/** @deprecated Enrichment is multi-origin — resolved via field-trust merge. */
export function isTicketIoEnrichmentSource(_sourceId: string | undefined): boolean {
  return false;
}

export {
  isRepairablePlaceholderText,
  resolveFillOnlyText,
  repairVersionChanged,
};

export function eventNeedsTicketIoFieldRepair(
  event: AdminEventRecord | null | undefined,
  metadata?: Record<string, unknown>,
): boolean {
  const platform = typeof metadata?.platform === 'string' ? metadata.platform : 'ticket_io';
  return eventNeedsTicketPlatformFieldRepair(event, {
    connectorKey: 'ticket_platform',
    platform,
  });
}

export function candidateCanRepairEvent(
  candidate: CanonicalImportEvent,
  event: AdminEventRecord | null | undefined,
): boolean {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const platform = typeof metadata?.platform === 'string' ? metadata.platform : 'ticket_io';
  return candidateCanRepairTicketPlatformEvent(candidate, event, {
    connectorKey: 'ticket_platform',
    platform,
  });
}

export { isTicketIoPlaceholderDescription };
