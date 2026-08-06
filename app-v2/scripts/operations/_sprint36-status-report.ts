import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { adminSourceRepository, eventRepository, importEventPublishService } from '@/data/repositories/registry';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { TICKET_IO_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/ticket-io-source';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint36_ticket_io_corpus_expansion.json',
);

async function main(): Promise<void> {
  await initializeEntityAliasStore();
  const client = getSupabaseServiceClient();

  const { count: canonical } = await client.from('events').select('*', { count: 'exact', head: true });
  const { count: published } = await client
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  const sources = await adminSourceRepository.getAll();
  const ticketIoSources = sources.filter(
    (source) => source.sourceConfig?.ticketPlatform?.platform === 'ticket_io',
  );
  const expansionSources = ticketIoSources.filter(
    (source) => source.id !== TICKET_IO_BOOTSHAUS_SOURCE_ID,
  );

  const originsBySource = [];
  for (const source of ticketIoSources) {
    const { count } = await client
      .from('event_source_references')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', source.id);
    originsBySource.push({
      sourceId: source.id,
      shopSlug: source.sourceConfig?.ticketPlatform?.shopSlug,
      behavior: source.sourceConfig?.publishPolicy?.behavior,
      origins: count ?? 0,
      enabled: source.enabled,
    });
  }

  const { data: jobs } = await client
    .from('import_jobs')
    .select('id,source_id,status,fetched_count,created_count,updated_count,unchanged_count,duplicate_count,connector_version,created_at')
    .in(
      'source_id',
      expansionSources.map((source) => source.id),
    )
    .order('created_at', { ascending: false })
    .limit(30);

  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();
  const discoverable = getDiscoverablePublishedEvents();
  const ticketIoDiscoverable = discoverable.filter((event) => event.ticketUrl?.includes('.ticket.io'));

  const report = {
    sprint: 36,
    phase: 'ticket-io-corpus-expansion-status',
    canonicalEvents: canonical ?? 0,
    publishedEvents: published ?? 0,
    discoverableEvents: discoverable.length,
    ticketIoDiscoverable: ticketIoDiscoverable.length,
    ticketIoSources: originsBySource,
    recentImportJobs: jobs ?? [],
    baselineFromPhase3: { canonical: 69, ticketIoDiscoverable: 17 },
    deltaFromPhase3: {
      canonical: (canonical ?? 0) - 69,
      ticketIoDiscoverable: ticketIoDiscoverable.length - 17,
    },
    finishedAt: new Date().toISOString(),
  };

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
