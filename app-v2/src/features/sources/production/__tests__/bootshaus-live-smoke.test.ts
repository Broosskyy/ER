import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { eventNormalizer } from '@/features/import/normalization/event-normalizer';
import { createBootshausLiveProductionSourceRecord } from '@/features/sources/production/production-source-records';

const BOOTSHAUS_LIVE_URL = 'https://bootshaus.tv/events/';

async function isBootshausReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(BOOTSHAUS_LIVE_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; live-smoke-test)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

describe('Bootshaus live smoke test', () => {
  it('fetches, extracts, normalizes and validates events from bootshaus.tv', async () => {
    const reachable = await isBootshausReachable();
    if (!reachable) {
      console.warn('Bootshaus live smoke test skipped: bootshaus.tv unreachable.');
      return;
    }

    const record = createBootshausLiveProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(record);

    const detection = await websiteProcessor.detect({
      url: BOOTSHAUS_LIVE_URL,
      importSource,
      connectorKey: 'club_website',
    });
    expect(detection.recommendedStrategy).toBeTruthy();
    expect(detection.eventContainerCount).toBeGreaterThan(0);

    const output = await websiteProcessor.process({
      url: BOOTSHAUS_LIVE_URL,
      importSource,
      connectorKey: 'club_website',
    });

    expect(output.events.length).toBeGreaterThan(0);
    expect(output.result.diagnostics.validEventCount).toBeGreaterThan(0);

    const sample = output.events[0]!;
    const normalized = eventNormalizer.normalize({
      externalId: sample.externalId,
      sourceUrl: sample.sourceUrl,
      title: sample.title,
      description: sample.description,
      startDate: sample.startDate,
      endDate: sample.endDate,
      timezone: sample.timezone,
      venueName: sample.venueName,
      eventUrl: sample.eventUrl,
      imageUrl: sample.imageUrl,
      rawSourceType: 'unknown',
    });

    expect(normalized.candidate?.title.length).toBeGreaterThan(0);
    expect(normalized.candidate?.startDate).toBeTruthy();
    expect(normalized.warnings).toHaveLength(0);
  }, 60_000);
});
