import './bootstrap-ops-supabase';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { resolveTicketShopBaseUrl } from '@/features/aggregation/connectors/ticket-platform/normalize-ticket-event';
import { adminSourceRepository } from '@/data/repositories/registry';
import type { ImportJobDiagnosticRow } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

async function main(): Promise<void> {
  const jobId = 'a25c23e5-0a7f-484d-8938-9cb02cab6385';
  const client = opsClient();
  const { data: job } = await client
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  const jobRow = job as ImportJobDiagnosticRow | null;

  const sourceRecord = await adminSourceRepository.getById('source-ticket-io-protontheclub');
  if (!sourceRecord) {
    throw new Error('source missing');
  }
  const importSource = mapSourceRecordToImportSource(sourceRecord);
  const aggregationSource = mapSourceRecordToAggregationSource(sourceRecord);

  const config = importSource.sourceConfig?.ticketPlatform;
  const listUrl = config?.listUrl ?? resolveTicketShopBaseUrl(config?.shopSlug ?? 'proton-the-club');
  const listResponse = await defaultHttpClient.fetch(listUrl, {
    headers: {
      'User-Agent': config?.userAgent ?? 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  const listHtml = await listResponse.text();
  const parsed = config ? parseTicketIoShopHtml(listHtml, config, {}) : null;

  let fetchError: unknown;
  let events: Awaited<ReturnType<typeof fetchTicketPlatformEvents>> | undefined;
  try {
    events = await fetchTicketPlatformEvents({
      source: aggregationSource,
      importSource,
      connectorKey: 'ticket_platform',
    });
  } catch (error) {
    fetchError = error;
  }

  console.log(
    JSON.stringify(
      {
        job: {
          status: jobRow?.status,
          warnings: jobRow?.warnings,
          errorMessage: jobRow?.error_message,
          metrics: jobRow?.metrics,
        },
        listUrl,
        listStatus: listResponse.status,
        listHtmlLength: listHtml.length,
        parsedEventCount: parsed?.events.length ?? 0,
        parsedFirstTitle: parsed?.events[0]?.title,
        fetchError: fetchError instanceof Error ? fetchError.message : fetchError,
        fetchedEventCount: events?.length ?? 0,
        firstEvent: events?.[0]
          ? {
              title: events[0].title,
              priceText: events[0].priceText,
              description: events[0].description,
              artistNames: events[0].artistNames,
              connectorVersion: events[0].sourceMetadata?.connectorVersion,
              repairVersion: (events[0].sourceMetadata as Record<string, unknown> | undefined)
                ?.dataQualityRepairVersion,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
