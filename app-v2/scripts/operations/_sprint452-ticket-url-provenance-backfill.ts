/**
 * Phase 4.5.2 — Backfill ticket_url provenance for Phase 4.5.1 corrections.
 *
 * Usage:
 *   npx tsx scripts/operations/_sprint452-ticket-url-provenance-backfill.ts
 *   npx tsx scripts/operations/_sprint452-ticket-url-provenance-backfill.ts --apply
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  importEventPublishService,
  multiSourceRepositories,
} from '@/data/repositories/registry';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';

const BOOTSHAUS_WEBSITE_SOURCE_ID = 'source-bootshaus-koeln';
const BOOTSHAUS_TICKET_IO_SOURCE_ID = 'source-bootshaus-ticket-io';
const GENERIC_SHOP = 'https://bootshaus.ticket.io/';
const applyChanges = process.argv.includes('--apply');
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint452_ticket_url_provenance_backfill.json',
);

function readTicketUrl(payload: Record<string, unknown> | null | undefined): string | undefined {
  const direct = payload?.ticketUrl ?? payload?.ticket_url;
  return typeof direct === 'string' ? direct : undefined;
}

type EventRow = { id: string; title: string; ticket_url: string | null };
type ProvenanceRow = {
  field_path: string;
  selected_value: string;
  selected_source_id: string;
  selection_reason: string;
};
type ImportRow = { external_id: string; normalized_payload: Record<string, unknown> | null };

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();
  const writer = new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance);
  const ticketSource = await adminSourceRepository.getById(BOOTSHAUS_TICKET_IO_SOURCE_ID);
  if (!ticketSource) {
    throw new Error('Bootshaus Ticket.io source missing.');
  }

  const { data: events } = await client
    .from('events')
    .select('id,title,ticket_url')
    .like('ticket_url', '%bootshaus-club.ticket.io/%');

  const corrections: Array<Record<string, unknown>> = [];

  for (const event of (events ?? []) as EventRow[]) {
    const { data: provenanceRow } = await client
      .from('event_field_provenance')
      .select('field_path,selected_value,selected_source_id,selection_reason')
      .eq('canonical_event_id', event.id)
      .eq('field_path', 'ticketUrl')
      .maybeSingle();
    const provenance = provenanceRow as ProvenanceRow | null;

    const { data: ticketIoRecord } = await client
      .from('import_records')
      .select('external_id,normalized_payload')
      .eq('source_id', BOOTSHAUS_TICKET_IO_SOURCE_ID)
      .eq('resulting_event_id', event.id)
      .maybeSingle();
    const ticketIo = ticketIoRecord as ImportRow | null;

    const ticketUrl = event.ticket_url as string;
    const needsBackfill =
      !provenance ||
      provenance.selected_value !== ticketUrl ||
      provenance.selected_source_id !== BOOTSHAUS_TICKET_IO_SOURCE_ID;

    if (!needsBackfill) {
      continue;
    }

    const entry = {
      eventId: event.id,
      title: event.title,
      ticketUrl,
      previousProvenance: provenance,
      ticketIoExternalId: ticketIo?.external_id,
      action: 'writeTicketUrlCorrection',
    };
    corrections.push(entry);

    if (applyChanges) {
      await writer.writeTicketUrlCorrection({
        canonicalEventId: event.id,
        ticketUrl,
        source: ticketSource,
        originExternalId: ticketIo?.external_id ?? ticketUrl,
        previousValue: GENERIC_SHOP,
        previousSourceId: BOOTSHAUS_WEBSITE_SOURCE_ID,
      });
    }
  }

  if (applyChanges && corrections.length > 0) {
    await importEventPublishService.refreshConsumerFeed();
  }

  const report = {
    phase: '4.5.2',
    applyChanges,
    candidates: corrections.length,
    corrections,
    completedAt: new Date().toISOString(),
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
