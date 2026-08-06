import type { UnifiedImportResult } from '@/features/import/contracts';
import { runOfficialWebsitePilotForEvent } from '@/features/import/pilots/official-website-pilot';
import type { GoldStandardReferenceEvent } from '@/features/import/pilots/gold-standard-reference';
import { runTicketIoPilotForTicketUrl } from '@/features/import/pilots/ticket-io-pilot';
import { runTicketKingsPilotForTicketUrl } from '@/features/import/pilots/ticket-kings-pilot';
import { runNachtManagerPilotForTicketUrl } from '@/features/import/pilots/nacht-manager-pilot';
import type { LiveSampleItem } from '@/features/import/pilots/live-sample-builder';

function toRef(item: LiveSampleItem): GoldStandardReferenceEvent {
  const platform = item.importer === 'ticket-io' ? 'ticket_io' : 'ticket_kings';
  return {
    key: item.sampleId,
    eventId: item.eventId,
    label: item.label,
    platform,
    websiteUrl: item.websiteUrl ?? item.url,
    ticketUrl: item.ticketUrl ?? item.url,
  };
}

export async function runPilotForSampleItem(
  item: LiveSampleItem,
): Promise<UnifiedImportResult | { error: string }> {
  switch (item.importer) {
    case 'official-website':
      return runOfficialWebsitePilotForEvent(toRef(item));
    case 'ticket-io':
      return runTicketIoPilotForTicketUrl({
        eventId: item.eventId,
        ticketUrl: item.url,
        label: item.label,
      });
    case 'ticket-kings':
      return runTicketKingsPilotForTicketUrl({
        eventId: item.eventId,
        ticketUrl: item.url,
        label: item.label,
      });
    case 'nacht-manager':
      return runNachtManagerPilotForTicketUrl({
        eventId: item.eventId,
        ticketUrl: item.url,
        label: item.label,
      });
    default:
      return { error: `Unknown importer ${item.importer}` };
  }
}

export function semanticPilotSnapshot(results: UnifiedImportResult[]): unknown[] {
  return results.map((r) => ({
    importerKey: r.sourceIdentity.importerKey,
    eventIds: [...new Set(r.fieldEvidenceCandidates.map((c) => c.eventIdentityMatch).filter(Boolean))],
    fields: r.fieldEvidenceCandidates.map((c) => ({
      field: c.fieldName,
      event: c.eventIdentityMatch,
      normalized: c.normalizedValue,
      role: c.sourceRole,
      url: c.originUrl,
    })),
    identity: r.eventIdentityCandidates,
  }));
}
