import type { ImportSource } from '@/features/import/models/types';
import type { ImportAdapterContext, ImportSourceAdapter } from '@/features/import/adapters/types';
import {
  buildAdapterResult,
  createSkippedRecord,
  getSourceUrl,
  processRawCandidate,
} from '@/features/import/adapters/adapter-utils';
import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { importFetchService } from '@/features/import/services/import-fetch-service';

export class JsonLdImportAdapter implements ImportSourceAdapter {
  readonly adapterKey = 'json_ld';

  async execute(source: ImportSource, context: ImportAdapterContext) {
    const url = source.sourceUrl ?? source.sourceConfig?.jsonLd?.pageUrl ?? source.website;
    if (!url) {
      throw new Error('JSON-LD source requires sourceUrl or jsonLd.pageUrl.');
    }

    const response = await importFetchService.fetch({
      url,
      allowedContentTypes: ['text/html', 'application/json', 'application/ld+json'],
    });

    const blocks =
      response.contentType.includes('html')
        ? extractJsonLdBlocks(response.body)
        : [JSON.parse(response.body) as unknown];

    const warnings: string[] = [];
    const records = [];
    let skippedCount = 0;

    for (const block of blocks) {
      const events = collectJsonLdNodes(block);
      for (const event of events) {
        if (!event.startDate) {
          warnings.push(`Skipped event "${String(event.name ?? 'unknown')}" — missing startDate.`);
          skippedCount += 1;
          records.push(
            createSkippedRecord(
              String(event['@id'] ?? event.name ?? `skip-${skippedCount}`),
              event as Record<string, unknown>,
              'Missing startDate in JSON-LD event.',
            ),
          );
          continue;
        }

        const parsed = parseJsonLdEvent(event, url);
        records.push(
          processRawCandidate(
            {
              externalId: parsed.externalId,
              sourceUrl: typeof event.url === 'string' ? event.url : url,
              rawSourceType: 'json_ld',
              ...parsed.fields,
            },
            source,
          ),
        );
      }
    }

    await context.log('info', 'JSON_LD_PARSED', `Parsed ${records.length} JSON-LD records from ${url}.`);

    return buildAdapterResult(records, warnings, skippedCount, {
      contentType: response.contentType,
      url,
      blockCount: blocks.length,
    });
  }
}
