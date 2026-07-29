import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import {
  AFFENKAEFIG_EVENTS_URL,
  createAffenkaefigLiveProductionSourceRecord,
} from '@/features/sources/production/affenkaefig-source';

const UNCONFIGURED_DOMAIN_MARKER = 'Diese Domain ist unkonfiguriert';

async function fetchAffenkaefigListPage(): Promise<{ ok: boolean; body: string; status: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(AFFENKAEFIG_EVENTS_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; live-smoke-test)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeout);
    const body = await response.text();
    return { ok: response.ok, body, status: response.status };
  } catch {
    return { ok: false, body: '', status: 0 };
  }
}

describe('Affenkäfig live smoke test', () => {
  it('reports live domain readiness without publishing fixture data', async () => {
    const live = await fetchAffenkaefigListPage();
    if (!live.ok || live.body.includes(UNCONFIGURED_DOMAIN_MARKER)) {
      console.warn(
        'Affenkäfig live smoke test skipped: affenkaefig.de is unconfigured or unreachable (status=%s).',
        live.status,
      );
      return;
    }

    const record = createAffenkaefigLiveProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(record);
    expect(record.sourceConfig?.reference?.html).toBeUndefined();

    const detection = await websiteProcessor.detect({
      url: AFFENKAEFIG_EVENTS_URL,
      importSource,
      connectorKey: 'organizer_website',
    });
    expect(detection.recommendedStrategy).toBeTruthy();

    const output = await websiteProcessor.process({
      url: AFFENKAEFIG_EVENTS_URL,
      importSource,
      connectorKey: 'organizer_website',
    });
    expect(output.events.length).toBeGreaterThan(0);
    expect(output.result.diagnostics.validEventCount).toBeGreaterThan(0);
  }, 60_000);
});
