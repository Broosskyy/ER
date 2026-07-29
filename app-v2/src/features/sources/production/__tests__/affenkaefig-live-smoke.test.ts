import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import {
  AFFENKAEFIG_EVENTS_URL,
  AFFENKAEFIG_LEGACY_DOMAIN,
  AFFENKAEFIG_OFFICIAL_DOMAIN,
  createAffenkaefigLiveProductionSourceRecord,
} from '@/features/sources/production/affenkaefig-source';

const UNCONFIGURED_DOMAIN_MARKER = 'Diese Domain ist unkonfiguriert';

async function fetchAffenkaefigListPage(): Promise<{ ok: boolean; body: string; status: number; finalUrl: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(AFFENKAEFIG_EVENTS_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; live-smoke-test)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const body = await response.text();
    return { ok: response.ok, body, status: response.status, finalUrl: response.url };
  } catch {
    return { ok: false, body: '', status: 0, finalUrl: '' };
  }
}

describe('Affenkäfig live smoke test', () => {
  it('read-only: parses future events from affenkaefig.info without publishing', async () => {
    const live = await fetchAffenkaefigListPage();
    expect(live.ok).toBe(true);
    expect(live.status).toBe(200);
    expect(live.finalUrl).toContain('affenkaefig.info');
    expect(live.body.includes(UNCONFIGURED_DOMAIN_MARKER)).toBe(false);
    expect(live.body).toContain('/event/');

    const legacy = await fetch(AFFENKAEFIG_LEGACY_DOMAIN, {
      headers: { 'User-Agent': 'EternalRave-SourceBot/1.0' },
    });
    const legacyBody = await legacy.text();
    expect(legacyBody.includes(UNCONFIGURED_DOMAIN_MARKER)).toBe(true);

    const record = createAffenkaefigLiveProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(record);
    expect(record.sourceConfig?.reference?.html).toBeUndefined();
    expect(record.enabled).toBe(false);

    const detection = await websiteProcessor.detect({
      url: AFFENKAEFIG_EVENTS_URL,
      importSource,
      connectorKey: 'organizer_website',
    });
    expect(detection.recommendedStrategy).toBe('event_detail_page');
    expect((detection.detailPageUrls?.length ?? 0)).toBeGreaterThan(0);

    const output = await websiteProcessor.process({
      url: AFFENKAEFIG_EVENTS_URL,
      importSource,
      connectorKey: 'organizer_website',
    });

    expect(output.result.diagnostics.strategy).toBe('event_detail_page');
    expect(output.result.diagnostics.detailPagesFetched).toBeGreaterThan(0);
    expect(output.events.length).toBeGreaterThan(0);
    expect(output.result.diagnostics.validEventCount).toBeGreaterThan(0);

    const sample = output.events[0]!;
    expect(sample.title).toBeTruthy();
    expect(sample.startDate).toMatch(/2026-/);
    expect(sample.externalId).toContain('affenkaefig.info/event/');
    expect(sample.venueName).toBeTruthy();
    expect(sample.imageUrl ?? sample.eventUrl).toBeTruthy();
    expect(sample.sourceMetadata?.connector).toBe('organizer_website');
    expect(AFFENKAEFIG_OFFICIAL_DOMAIN).toBe('https://affenkaefig.info');
  }, 120_000);
});
