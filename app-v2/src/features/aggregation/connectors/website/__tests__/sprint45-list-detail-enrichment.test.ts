import { describe, expect, it } from 'vitest';

import { enrichWebsiteListEventsWithDetailPages } from '@/features/aggregation/connectors/website/list-detail-enrichment';
import { BOOTSHAUS_WEBSITE_CONFIG } from '@/features/sources/production/production-source-records';
import {
  BOOTSHAUS_DETAIL_FIXTURE_HTML,
  BOOTSHAUS_DETAIL_URL,
} from '@/features/sources/production/bootshaus-fixture';
import type { RawWebsiteEvent, WebsiteDocument } from '@/features/aggregation/connectors/website/types';

describe('website list-detail enrichment', () => {
  const listEvent: RawWebsiteEvent = {
    sourceUrl: 'https://bootshaus.tv/events/',
    detailUrl: BOOTSHAUS_DETAIL_URL,
    externalId: BOOTSHAUS_DETAIL_URL,
    title: 'PLAY! Open Air – Bootshaus Köln',
    extractionStrategy: 'html_selector',
    extractionConfidence: 0.9,
    fieldEvidence: [],
    warnings: [],
  };

  it('skips enrichment when maxDetailPages is zero', async () => {
    const result = await enrichWebsiteListEventsWithDetailPages({
      events: [listEvent],
      config: BOOTSHAUS_WEBSITE_CONFIG,
      limits: { ...BOOTSHAUS_WEBSITE_CONFIG.limits!, maxDetailPages: 0 },
      baseUrl: 'https://bootshaus.tv/events/',
      connectorKey: 'club_website',
      fetchDetailPage: async () => {
        throw new Error('should not fetch');
      },
    });
    expect(result.events[0].rawDescription).toBeUndefined();
    expect(result.diagnostics.skipped).toBe(1);
  });

  it('merges og:description from detail page into list event', async () => {
    const detailDocument: WebsiteDocument = {
      requestedUrl: BOOTSHAUS_DETAIL_URL,
      finalUrl: BOOTSHAUS_DETAIL_URL,
      html: BOOTSHAUS_DETAIL_FIXTURE_HTML,
      responseSize: BOOTSHAUS_DETAIL_FIXTURE_HTML.length,
      redirectChain: [],
      contentType: 'text/html',
      statusCode: 200,
      fetchedAt: new Date().toISOString(),
      headers: {},
    };

    const result = await enrichWebsiteListEventsWithDetailPages({
      events: [listEvent],
      config: BOOTSHAUS_WEBSITE_CONFIG,
      limits: BOOTSHAUS_WEBSITE_CONFIG.limits!,
      baseUrl: 'https://bootshaus.tv/events/',
      connectorKey: 'club_website',
      fetchDetailPage: async () => detailDocument,
    });

    expect(result.diagnostics.enriched).toBe(1);
    expect(result.events[0].rawDescription).toContain('Drum');
    expect(result.events[0].warnings).toContain('detail_enrichment_applied');
  });
});
