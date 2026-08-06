import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { enrichWebsiteListEventsWithDetailPages } from '@/features/aggregation/connectors/website/list-detail-enrichment';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { featureFlags } from '@/core/config/feature-flags';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { simulateMultiSourceMerge } from '@/features/import/pilots/merge-simulation';
import { extractOfficialWebsitePublicTruth } from '@/features/import/shadow/official-website-public-truth';
import {
  beginIntegratedShadowSession,
  classifyIntegratedFieldComparison,
  endIntegratedShadowSession,
  extractLegacyIntegratedField,
  extractUnifiedIntegratedField,
  INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
  maybeRunIntegratedShadowExtraction,
  resetIntegratedShadowSession,
  resolveIntegratedShadowConfig,
  validateIntegratedShadowIdentities,
} from '@/features/import/shadow/unified-website-integrated-shadow';
import {
  createBootshausProductionSourceRecord,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/production-source-records';
import { BOOTSHAUS_LIST_FIXTURE_HTML } from '@/features/sources/production/bootshaus-fixture';
import type { RawWebsiteEvent, WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import { BOOTSHAUS_WEBSITE_CONFIG } from '@/features/sources/production/production-source-records';

const R3HAB_URL = 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus';
const SOMMERFEST_URL = 'https://bootshaus.tv/events/bootshaus-sommerfest';
const R3HAB_FIXTURE = join(
  process.cwd(),
  'docs/real-data/_phase4823_live_evidence/live-official-website-98.html',
);
const SOMMERFEST_FIXTURE = join(
  process.cwd(),
  'docs/real-data/_phase4823_live_evidence/live-official-website-80.html',
);

function loadFixture(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('phase485 integrated shadow feature flags', () => {
  it('defaults to disabled with empty allowlist', () => {
    const config = resolveIntegratedShadowConfig();
    expect(config.enabled).toBe(false);
    expect(config.sourceIds).toEqual([]);
    expect(config.noWrite).toBe(true);
    expect(featureFlags.unifiedWebsiteIntegratedShadowEnabled).toBe(false);
  });
});

describe('phase485 integrated shadow html reuse', () => {
  beforeEach(() => {
    resetIntegratedShadowSession();
    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig({
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        sampleLimit: 50,
        noWrite: true,
      }),
    );
  });

  afterEach(() => {
    endIntegratedShadowSession();
    resetIntegratedShadowSession();
  });

  it('runs unified extraction on reused detail HTML without extra fetch', async () => {
    const html = loadFixture(R3HAB_FIXTURE);
    const listEvent: RawWebsiteEvent = {
      sourceUrl: R3HAB_URL,
      detailUrl: R3HAB_URL,
      externalId: R3HAB_URL,
      title: 'R3HAB pres. by BOOTSHAUS | Bootshaus Club',
      extractionStrategy: 'html_selector',
      extractionConfidence: 0.9,
      fieldEvidence: [],
      warnings: [],
    };
    const detailDocument: WebsiteDocument = {
      requestedUrl: R3HAB_URL,
      finalUrl: R3HAB_URL,
      html,
      responseSize: html.length,
      redirectChain: [],
      contentType: 'text/html',
      statusCode: 200,
      fetchedAt: new Date().toISOString(),
      headers: {},
    };
    let fetchCount = 0;

    await enrichWebsiteListEventsWithDetailPages({
      events: [listEvent],
      config: BOOTSHAUS_WEBSITE_CONFIG,
      limits: BOOTSHAUS_WEBSITE_CONFIG.limits!,
      baseUrl: 'https://bootshaus.tv/events/',
      connectorKey: 'club_website',
      fetchDetailPage: async () => {
        fetchCount += 1;
        return detailDocument;
      },
      integratedShadow: {
        sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
        sourceName: 'Bootshaus Köln',
        configOverrides: {
          enabled: true,
          sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        },
      },
    });

    expect(fetchCount).toBe(1);
    const report = endIntegratedShadowSession();
    expect(report?.performance.htmlReuseCount).toBe(1);
    expect(report?.performance.extraHttpRequests).toBe(0);
    expect(report?.events[0]?.unifiedResult).toBeDefined();
  });
});

describe('phase485 failure isolation', () => {
  it('does not throw when unified shadow extraction fails deliberately', () => {
    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig({
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        sampleLimit: 10,
      }),
    );

    const legacyEvent: RawWebsiteEvent = {
      sourceUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
      detailUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
      externalId: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
      title: 'Failure fixture',
      extractionStrategy: 'html_selector',
      extractionConfidence: 0.5,
      fieldEvidence: [],
      warnings: [],
    };

    expect(() =>
      maybeRunIntegratedShadowExtraction({
        sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
        sourceName: 'Bootshaus Köln',
        detailUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
        html: '<html></html>',
        finalUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
        httpStatus: 200,
        legacyEvent,
        configOverrides: {
          enabled: true,
          sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        },
      }),
    ).not.toThrow();

    const report = endIntegratedShadowSession();
    expect(report?.events[0]?.unifiedError).toContain('Deliberate');
    expect(report?.performance.unifiedFailures).toBe(1);
  });

  it('legacy processor completes when shadow is disabled', async () => {
    const source = mapSourceRecordToImportSource(createBootshausProductionSourceRecord());
    const output = await websiteProcessor.process({
      url: 'https://bootshaus.tv/events/',
      importSource: source,
      connectorKey: 'club_website',
      htmlOverride: BOOTSHAUS_LIST_FIXTURE_HTML,
      integratedShadowOverrides: { enabled: false, sourceIds: [] },
    });
    expect(output.events.length).toBeGreaterThan(0);
    expect(output.integratedShadowReport).toBeUndefined();
  });
});

describe('phase485 R3HAB integrated trace', () => {
  it('produces correct unified fields from shared HTML', () => {
    const html = loadFixture(R3HAB_FIXTURE);
    const publicTruth = extractOfficialWebsitePublicTruth(html, R3HAB_URL);
    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig({
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        sampleLimit: 5,
      }),
    );

    const legacyEvent: RawWebsiteEvent = {
      sourceUrl: R3HAB_URL,
      detailUrl: R3HAB_URL,
      externalId: R3HAB_URL,
      title: 'R3HAB pres. by BOOTSHAUS | Bootshaus Club',
      rawDescription: String(publicTruth.description),
      extractionStrategy: 'html_selector',
      extractionConfidence: 0.9,
      fieldEvidence: [],
      warnings: [],
    };

    maybeRunIntegratedShadowExtraction({
      sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
      sourceName: 'Bootshaus Köln',
      detailUrl: R3HAB_URL,
      html,
      finalUrl: R3HAB_URL,
      httpStatus: 200,
      legacyEvent,
      configOverrides: {
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
      },
    });

    const report = endIntegratedShadowSession()!;
    const unified = report.events[0]?.unifiedResult;
    const eventId =
      unified?.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ?? '';

    const title = extractUnifiedIntegratedField(unified, eventId, 'title');
    expect(title).toBe('R3HAB pres. by BOOTSHAUS');

    const description = extractUnifiedIntegratedField(unified, eventId, 'description');
    expect(String(description)).toContain('September 4th');
    expect(String(description)).not.toContain('August 7th');
    expect(String(description)).not.toContain('bit.ly');

    const lineup = extractUnifiedIntegratedField(unified, eventId, 'lineupEntries');
    expect(lineup).toEqual(['R3HAB', 'LA FUENTE', 'OLIVER MAGENTA', 'RELOVA', 'DAVE REPLAY']);

    const ticket = extractUnifiedIntegratedField(unified, eventId, 'ticketUrl');
    expect(ticket).toBe('https://bootshaus-club.ticket.io/C7JPnatZ/');

    expect(unified?.fieldEvidenceCandidates.some((c) => String(c.fieldName).includes('price'))).toBe(
      false,
    );
  });
});

describe('phase485 Sommerfest integrated trace', () => {
  it('keeps TBA lineup and avoids Bootshaus venue inference', () => {
    const html = loadFixture(SOMMERFEST_FIXTURE);
    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig({
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        sampleLimit: 5,
      }),
    );

    const legacyEvent: RawWebsiteEvent = {
      sourceUrl: SOMMERFEST_URL,
      detailUrl: SOMMERFEST_URL,
      externalId: SOMMERFEST_URL,
      title: 'Bootshaus Sommerfest | Bootshaus Club',
      extractionStrategy: 'html_selector',
      extractionConfidence: 0.9,
      fieldEvidence: [],
      warnings: [],
    };

    maybeRunIntegratedShadowExtraction({
      sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
      sourceName: 'Bootshaus Köln',
      detailUrl: SOMMERFEST_URL,
      html,
      finalUrl: SOMMERFEST_URL,
      httpStatus: 200,
      legacyEvent,
      configOverrides: {
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
      },
    });

    const report = endIntegratedShadowSession()!;
    const unified = report.events[0]?.unifiedResult;
    const eventId =
      unified?.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ?? '';

    expect(extractUnifiedIntegratedField(unified, eventId, 'title')).toBe('Bootshaus Sommerfest');
    expect(extractUnifiedIntegratedField(unified, eventId, 'lineupState')).toBe('tba');
    expect(extractUnifiedIntegratedField(unified, eventId, 'lineupEntries')).toEqual([]);
    expect(extractUnifiedIntegratedField(unified, eventId, 'venue')).toBeUndefined();
    expect(extractUnifiedIntegratedField(unified, eventId, 'ticketUrl')).toBe(
      'https://bootshaus-club.ticket.io/vB0cAmWg/',
    );
  });
});

describe('phase485 identity validation', () => {
  it('keeps Bootshaus Sommerfest separate from Sommerfest Elektroküche', () => {
    const result = validateIntegratedShadowIdentities([
      {
        detailUrl: SOMMERFEST_URL,
        externalId: SOMMERFEST_URL,
        legacyTitle: 'Bootshaus Sommerfest',
        htmlBytes: 1,
        htmlReused: true,
        extraHttpRequests: 0,
      },
      {
        detailUrl: 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026',
        externalId: 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026',
        legacyTitle: 'Sommerfest Elektroküche',
        htmlBytes: 1,
        htmlReused: true,
        extraHttpRequests: 0,
      },
    ]);
    expect(result.valid).toBe(true);
  });
});

describe('phase485 merge simulation bridge', () => {
  it('simulates winners without persisting', () => {
    const html = loadFixture(R3HAB_FIXTURE);
    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig({
        enabled: true,
        sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID],
        sampleLimit: 1,
      }),
    );
    maybeRunIntegratedShadowExtraction({
      sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
      sourceName: 'Bootshaus Köln',
      detailUrl: R3HAB_URL,
      html,
      finalUrl: R3HAB_URL,
      httpStatus: 200,
      legacyEvent: {
        sourceUrl: R3HAB_URL,
        detailUrl: R3HAB_URL,
        externalId: R3HAB_URL,
        title: 'R3HAB',
        extractionStrategy: 'html_selector',
        extractionConfidence: 0.5,
        fieldEvidence: [],
        warnings: [],
      },
      configOverrides: { enabled: true, sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID] },
    });
    const report = endIntegratedShadowSession()!;
    const unified = report.events[0]?.unifiedResult;
    expect(unified).toBeDefined();
    const simulation = simulateMultiSourceMerge(
      unified!.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ?? '',
      'r3hab',
      [unified!],
    );
    expect(simulation.fieldDecisions.length).toBeGreaterThan(0);
    expect(simulation.fieldDecisions.some((d) => d.winner)).toBe(true);
  });
});
