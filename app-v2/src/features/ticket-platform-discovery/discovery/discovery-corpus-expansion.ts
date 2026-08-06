import type { SourceRecord } from '@/data/types/records';
import { extractTicketIoShopSlugsFromText } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { collectDiscoveryCorpusFromSources } from '@/features/ticket-platform-discovery/discovery/discovery-corpus';
import { collectTicketIoSeedCorpusTexts } from '@/features/ticket-platform-discovery/discovery/ticket-io-seed-urls';

export interface ExpandedDiscoveryCorpus {
  texts: string[];
  sources: {
    configuredSources: number;
    seedUrls: number;
    publishedEventUrls: number;
    importRecordUrls: number;
    extractedSlugs: string[];
  };
}

export function collectTicketUrlsFromTextBlocks(texts: string[]): string[] {
  const urls = new Set<string>();
  const pattern = /https?:\/\/[a-z0-9][a-z0-9-]*\.ticket\.io(?:\/[^\s"'<>]*)?/gi;
  for (const text of texts) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, 'gi');
    while ((match = regex.exec(text)) !== null) {
      urls.add(match[0]);
    }
  }
  return [...urls];
}

export async function collectPublishedEventTicketUrls(
  fetchPublishedEvents: () => Promise<Array<{ ticketUrl?: string; websiteUrl?: string; description?: string }>>,
): Promise<string[]> {
  const events = await fetchPublishedEvents();
  const urls: string[] = [];
  for (const event of events) {
    if (event.ticketUrl) {
      urls.push(event.ticketUrl);
    }
    if (event.websiteUrl?.includes('.ticket.io')) {
      urls.push(event.websiteUrl);
    }
    if (event.description) {
      urls.push(...collectTicketUrlsFromTextBlocks([event.description]));
    }
  }
  return urls;
}

export async function collectImportRecordTicketUrls(
  fetchImportRecordPayloads: () => Promise<Array<Record<string, unknown>>>,
): Promise<string[]> {
  const payloads = await fetchImportRecordPayloads();
  const urls: string[] = [];
  for (const payload of payloads) {
    const ticketUrl = payload.ticketUrl ?? payload.eventUrl ?? payload.sourceUrl;
    if (typeof ticketUrl === 'string' && ticketUrl.includes('.ticket.io')) {
      urls.push(ticketUrl);
    }
    const metadata = payload.sourceMetadata as Record<string, unknown> | undefined;
    if (metadata && typeof metadata.shopSlug === 'string') {
      urls.push(`https://${metadata.shopSlug}.ticket.io/`);
    }
    urls.push(...collectTicketUrlsFromTextBlocks([JSON.stringify(payload)]));
  }
  return urls;
}

export async function buildExpandedDiscoveryCorpus(input: {
  sources: SourceRecord[];
  fetchPublishedEvents?: () => Promise<Array<{ ticketUrl?: string; websiteUrl?: string; description?: string }>>;
  fetchImportRecordPayloads?: () => Promise<Array<Record<string, unknown>>>;
  includeSeeds?: boolean;
}): Promise<ExpandedDiscoveryCorpus> {
  const texts: string[] = [...collectDiscoveryCorpusFromSources(input.sources)];

  const seedTexts = input.includeSeeds !== false ? collectTicketIoSeedCorpusTexts() : [];
  texts.push(...seedTexts);

  let publishedEventUrls: string[] = [];
  if (input.fetchPublishedEvents) {
    publishedEventUrls = await collectPublishedEventTicketUrls(input.fetchPublishedEvents);
    texts.push(...publishedEventUrls);
  }

  let importRecordUrls: string[] = [];
  if (input.fetchImportRecordPayloads) {
    importRecordUrls = await collectImportRecordTicketUrls(input.fetchImportRecordPayloads);
    texts.push(...importRecordUrls);
  }

  const extractedSlugs = extractTicketIoShopSlugsFromText(texts.join('\n'));

  return {
    texts,
    sources: {
      configuredSources: input.sources.length,
      seedUrls: seedTexts.length,
      publishedEventUrls: publishedEventUrls.length,
      importRecordUrls: importRecordUrls.length,
      extractedSlugs,
    },
  };
}
