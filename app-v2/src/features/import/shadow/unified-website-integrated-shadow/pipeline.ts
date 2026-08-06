import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { websiteFetchLayer } from '@/features/aggregation/connectors/website/fetch';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import type { WebsiteProcessorOutput } from '@/features/aggregation/connectors/website/processor';
import type { SourceRecord } from '@/data/types/records';
import {
  type IntegratedShadowConfigOverrides,
  type IntegratedShadowSessionReport,
} from '@/features/import/shadow/unified-website-integrated-shadow';

export type IntegratedShadowPipelineResult = {
  legacy: WebsiteProcessorOutput;
  shadowReport?: IntegratedShadowSessionReport;
  fixtureFetchCount: number;
  liveFetchCount: number;
};

export async function runIntegratedShadowWebsitePipeline(input: {
  sourceRecord: SourceRecord;
  listUrl: string;
  connectorKey: string;
  htmlFixturesByUrl: Record<string, string>;
  shadowOverrides: IntegratedShadowConfigOverrides;
}): Promise<IntegratedShadowPipelineResult> {
  const importSource = mapSourceRecordToImportSource(input.sourceRecord);
  const normalizedFixtures = new Map<string, string>();
  for (const [url, html] of Object.entries(input.htmlFixturesByUrl)) {
    normalizedFixtures.set(url.replace(/\/$/, '').toLowerCase(), html);
  }

  let fixtureFetchCount = 0;
  let liveFetchCount = 0;
  const originalFetch = websiteFetchLayer.fetchDocument.bind(websiteFetchLayer);

  websiteFetchLayer.fetchDocument = async (request) => {
    const key = request.url.replace(/\/$/, '').toLowerCase();
    const fixture = normalizedFixtures.get(key);
    if (fixture !== undefined) {
      fixtureFetchCount += 1;
      return originalFetch({ ...request, htmlOverride: fixture });
    }
    liveFetchCount += 1;
    return originalFetch(request);
  };

  try {
    const legacy = await websiteProcessor.process({
      url: input.listUrl,
      importSource,
      connectorKey: input.connectorKey,
      htmlOverride: normalizedFixtures.get(input.listUrl.replace(/\/$/, '').toLowerCase()),
      integratedShadowOverrides: input.shadowOverrides,
    });
    return {
      legacy,
      shadowReport: legacy.integratedShadowReport,
      fixtureFetchCount,
      liveFetchCount,
    };
  } finally {
    websiteFetchLayer.fetchDocument = originalFetch;
  }
}
