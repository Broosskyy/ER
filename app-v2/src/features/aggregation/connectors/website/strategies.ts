import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type { RawWebsiteEvent, WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import {
  createFieldEvidence,
  createValidationResult,
  type WebsiteExtractionStrategy,
  type WebsiteStrategyContext,
} from '@/features/aggregation/connectors/website/strategy-types';

export const jsonLdWebsiteStrategy: WebsiteExtractionStrategy = {
  key: 'json_ld',
  version: '1.0.0',
  capabilities: {
    supportsListPages: true,
    supportsDetailPages: false,
    supportsPagination: false,
    requiresConfiguration: false,
  },
  supports(document) {
    return extractJsonLdBlocks(document.html).length > 0 || document.html.trim().startsWith('{');
  },
  detect(document) {
    const blocks = document.html.trim().startsWith('{')
      ? [JSON.parse(document.html) as unknown]
      : extractJsonLdBlocks(document.html);
    const events = blocks.flatMap((block) => collectJsonLdNodes(block));
    return {
      confidence: events.length > 0 ? 0.95 : 0,
      signals: events.length > 0 ? [{ format: 'schema_org_event', confidence: 0.95, count: events.length }] : [],
      eventCountEstimate: events.length,
    };
  },
  validateConfiguration() {
    return createValidationResult([]);
  },
  async extract(document, _config, context) {
    const blocks = document.html.trim().startsWith('{')
      ? [JSON.parse(document.html) as unknown]
      : extractJsonLdBlocks(document.html);
    const events: RawWebsiteEvent[] = [];
    const warnings: string[] = [];
    let skippedCount = 0;

    let index = 0;
    for (const block of blocks) {
      for (const node of collectJsonLdNodes(block)) {
        const record = node as Record<string, unknown>;
        if (!record.startDate) {
          skippedCount += 1;
          warnings.push(`Skipped JSON-LD node without startDate at index ${index}.`);
          continue;
        }
        const parsed = parseJsonLdEvent(record, context.baseUrl);
        const externalId = parsed.externalId || `jsonld-${index}`;
        events.push({
          sourceUrl: document.finalUrl,
          detailUrl: typeof record.url === 'string' ? record.url : undefined,
          externalId,
          title: typeof parsed.fields.title === 'string' ? parsed.fields.title : undefined,
          rawStartDate: typeof parsed.fields.startDate === 'string' ? parsed.fields.startDate : undefined,
          rawEndDate: typeof parsed.fields.endDate === 'string' ? parsed.fields.endDate : undefined,
          rawVenue: typeof parsed.fields.venueName === 'string' ? parsed.fields.venueName : undefined,
          rawLocation: typeof parsed.fields.venueAddress === 'string' ? parsed.fields.venueAddress : undefined,
          rawDescription: typeof parsed.fields.description === 'string' ? parsed.fields.description : undefined,
          rawArtists: Array.isArray(parsed.fields.artistNames) ? parsed.fields.artistNames : undefined,
          rawTicketLinks: parsed.fields.ticketUrl ? [String(parsed.fields.ticketUrl)] : undefined,
          rawImages: parsed.fields.imageUrl ? [String(parsed.fields.imageUrl)] : undefined,
          rawOrganizer: typeof parsed.fields.organizerName === 'string' ? parsed.fields.organizerName : undefined,
          extractionStrategy: 'json_ld',
          extractionConfidence: 0.95,
          fieldEvidence: [
            createFieldEvidence('title', 'json_ld', document.finalUrl, {
              selectorOrPath: 'name',
              rawValue: typeof parsed.fields.title === 'string' ? parsed.fields.title : undefined,
            }),
          ],
          warnings: [],
        });
        index += 1;
      }
    }

    return {
      events,
      diagnostics: { extractedCount: events.length, skippedCount, warnings },
    };
  },
};

function readPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, root);
}

function collectEventsFromValue(value: unknown, path: string, results: Array<{ path: string; item: Record<string, unknown> }>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object') {
        results.push({ path, item: item as Record<string, unknown> });
      }
    }
    return;
  }
  if (value && typeof value === 'object') {
    results.push({ path, item: value as Record<string, unknown> });
  }
}

export const embeddedJsonWebsiteStrategy: WebsiteExtractionStrategy = {
  key: 'embedded_json',
  version: '1.0.0',
  capabilities: {
    supportsListPages: true,
    supportsDetailPages: false,
    supportsPagination: false,
    requiresConfiguration: false,
  },
  supports(document) {
    return /__NEXT_DATA__|application\/json|__NUXT__/i.test(document.html);
  },
  detect(document) {
    const matches = (document.html.match(/application\/json|__NEXT_DATA__|__NUXT__/gi) ?? []).length;
    return {
      confidence: matches > 0 ? 0.8 : 0,
      signals: matches > 0 ? [{ format: 'embedded_json', confidence: 0.8, count: matches }] : [],
      eventCountEstimate: 0,
    };
  },
  validateConfiguration(config) {
    if (config.embeddedJson?.collectionPaths?.some((path) => !path.trim())) {
      return createValidationResult([{ code: 'invalid_path', field: 'embeddedJson.collectionPaths', message: 'Collection paths must not be empty.' }]);
    }
    return createValidationResult([]);
  },
  async extract(document, config, context) {
    const payloads: unknown[] = [];
    const nextDataMatch = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(document.html);
    if (nextDataMatch?.[1]) {
      try {
        payloads.push(JSON.parse(nextDataMatch[1]));
      } catch {
        // skip invalid payload
      }
    }
    const appJsonPattern = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = appJsonPattern.exec(document.html)) !== null) {
      try {
        payloads.push(JSON.parse(match[1] ?? '{}'));
      } catch {
        // skip
      }
    }

    const paths = config.embeddedJson?.collectionPaths ?? ['props.pageProps.events', 'events', 'data.events'];
    const collected: Array<{ path: string; item: Record<string, unknown> }> = [];
    for (const payload of payloads) {
      for (const path of paths) {
        collectEventsFromValue(readPath(payload, path), path, collected);
      }
    }

    const events: RawWebsiteEvent[] = collected.map(({ path, item }, index) => ({
      sourceUrl: document.finalUrl,
      externalId: String(item.id ?? item.slug ?? item.url ?? `embedded-${index}`),
      title: typeof item.title === 'string' ? item.title : typeof item.name === 'string' ? item.name : undefined,
      rawStartDate: typeof item.startDate === 'string' ? item.startDate : typeof item.starts_at === 'string' ? item.starts_at : undefined,
      rawEndDate: typeof item.endDate === 'string' ? item.endDate : typeof item.ends_at === 'string' ? item.ends_at : undefined,
      rawDescription: typeof item.description === 'string' ? item.description : undefined,
      extractionStrategy: 'embedded_json',
      extractionConfidence: 0.75,
      fieldEvidence: [createFieldEvidence('title', 'embedded_json', context.baseUrl, { selectorOrPath: path })],
      warnings: [],
    }));

    return {
      events,
      diagnostics: {
        extractedCount: events.length,
        skippedCount: 0,
        warnings: events.length === 0 ? ['No embedded JSON events found at configured paths.'] : [],
      },
    };
  },
};
