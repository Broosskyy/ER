import { beforeEach, describe, expect, it } from 'vitest';

import type {
  OfficialConnector,
  OfficialConnectorMetadata,
  OfficialConnectorRunOptions,
  OfficialConnectorRunResult,
} from '../../../official-connectors/connector-contract';
import {
  createEmptyConnectorCounters,
  type OfficialEventConsumerPreview,
  type OfficialEventEvidence,
} from '../../../official-connectors/types';
import { OfficialSourceRegistry } from '../../../official-connectors/source-registry';
import {
  resetSourceOperationalConfigRegistryForTests,
  SourceOperationalConfigRegistry,
} from '../../../official-connectors/source-operational-config';
import {
  PRODUCTION_SCHEDULER_ENABLED,
  STAGING_SCHEDULER_ENABLED,
  STAGING_SCHEDULED_CONNECTOR_IDS,
} from '../scheduler-boundary';
import {
  evaluateScheduledApplyGuard,
  productionSchedulerApplyWouldBeRejected,
} from '../scheduler-guard';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../staging-guard';
import { runSourceSync, type SyncOrchestratorDependencies } from '../orchestrator';
import { createInMemoryIngestionSyncPersistence } from '../run-persistence';

function buildEvidence(overrides: Partial<OfficialEventEvidence> & Pick<OfficialEventEvidence, 'sourceEventKey' | 'officialUrl' | 'title' | 'startsAt'>): OfficialEventEvidence {
  return {
    connectorId: 'bootshaus-official',
    listUrl: 'https://example.com/events/',
    fetchedAt: '2026-08-14T12:00:00.000Z',
    pageFingerprint: `fp-${overrides.sourceEventKey}`,
    sourceTimezone: 'Europe/Berlin',
    venue: { name: 'Bootshaus', city: 'Köln', postalCode: '51063', countryCode: 'DE' },
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps: [],
    rejectedCandidates: [],
    ...overrides,
  };
}

function buildPreview(evidence: OfficialEventEvidence): OfficialEventConsumerPreview {
  return { ...evidence, decision: 'preview_ready', reviewReasons: [] };
}

function buildRunResult(previews: OfficialEventConsumerPreview[]): OfficialConnectorRunResult {
  const detailUrls = previews.map((preview) => preview.officialUrl);
  return {
    fetchedAt: '2026-08-14T12:00:00.000Z',
    listUrl: 'https://example.com/events/',
    discoveredDetailUrls: detailUrls,
    loadedDetailUrls: detailUrls,
    previews,
    counters: createEmptyConnectorCounters(),
    mediaCounters: {
      imagesConsidered: 0,
      imagesDownloaded: 0,
      imagesRejectedLowQuality: 0,
      imagesRejectedPolicy: 0,
      ocrAttempts: 0,
      ocrSuccesses: 0,
      lineupActsCorroborated: 0,
      lineupActsRejected: 0,
    },
  };
}

class MockOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata;

  constructor(
    connectorId: string,
    private readonly handler: (options?: OfficialConnectorRunOptions) => Promise<OfficialConnectorRunResult>,
  ) {
    this.metadata = {
      connectorId,
      sourceType: 'venue_club',
      displayName: connectorId,
      defaultListUrl: 'https://example.com/events/',
      capabilities: { listDiscovery: true, detailFetch: true, mediaEnrichment: false },
    };
  }

  discoverFromListHtml() {
    return { listUrl: 'https://example.com/events/', detailUrls: [], duplicateCount: 0 };
  }

  async fetchHtml(url: string) {
    return { finalUrl: url, html: '<html></html>', contentType: 'text/html' };
  }

  parseDetailPage() {
    return buildEvidence({
      sourceEventKey: 'unused',
      officialUrl: 'https://example.com/events/unused/',
      title: 'Unused',
      startsAt: '2027-08-21T22:00:00+02:00',
    });
  }

  runPreview(options?: OfficialConnectorRunOptions): Promise<OfficialConnectorRunResult> {
    return this.handler(options);
  }
}

function createDeps(connector: MockOfficialConnector, enabled = true): SyncOrchestratorDependencies {
  const registry = new OfficialSourceRegistry();
  registry.register(connector);
  const operationalConfig = new SourceOperationalConfigRegistry();
  operationalConfig.register({
    connectorId: connector.metadata.connectorId,
    sourceType: 'venue_club',
    enabled,
    defaultIntervalMinutes: 360,
    maxConcurrency: 1,
    requestSpacingMs: 0,
    timeoutMs: 30_000,
    expectedMinParsedOnSuccess: 1,
  });
  return {
    registry,
    operationalConfig,
    persistence: createInMemoryIngestionSyncPersistence(),
    loadPlannerContext: async () => ({
      existingSources: [],
      existingVenues: [],
      existingEvents: [],
      eventCatalog: [],
    }),
    linkedProjectRef: STAGING_PROJECT_REF,
  };
}

describe('M9.0 staging scheduler', () => {
  beforeEach(() => {
    resetSourceOperationalConfigRegistryForTests();
  });

  it('enables staging scheduler and keeps production scheduler disabled', () => {
    expect(STAGING_SCHEDULER_ENABLED).toBe(true);
    expect(PRODUCTION_SCHEDULER_ENABLED).toBe(false);
    expect(STAGING_SCHEDULED_CONNECTOR_IDS).toEqual(['bootshaus-official', 'affenkaefig-official']);
  });

  it('rejects production project ref for scheduled apply', () => {
    const result = evaluateScheduledApplyGuard({
      connectorId: 'bootshaus-official',
      mode: 'apply',
      triggerType: 'scheduled',
      linkedProjectRef: PRODUCTION_PROJECT_REF,
    });
    expect(result.allowed).toBe(false);
    expect(result.errorCategory).toBe('production_scheduler_forbidden');
    expect(productionSchedulerApplyWouldBeRejected(PRODUCTION_PROJECT_REF)).toBe(true);
  });

  it('allows scheduled apply on staging for registered connectors', () => {
    const result = evaluateScheduledApplyGuard({
      connectorId: 'bootshaus-official',
      mode: 'apply',
      triggerType: 'scheduled',
      linkedProjectRef: STAGING_PROJECT_REF,
    });
    expect(result.allowed).toBe(true);
    expect(productionSchedulerApplyWouldBeRejected(STAGING_PROJECT_REF)).toBe(false);
  });

  it('blocks scheduled apply when global scheduler is disabled', () => {
    const result = evaluateScheduledApplyGuard(
      {
        connectorId: 'bootshaus-official',
        mode: 'apply',
        triggerType: 'scheduled',
        linkedProjectRef: STAGING_PROJECT_REF,
      },
      { stagingSchedulerEnabled: false },
    );
    expect(result.allowed).toBe(false);
    expect(result.errorCategory).toBe('scheduler_disabled');
  });

  it('blocks scheduled apply when source is disabled', async () => {
    const connector = new MockOfficialConnector('bootshaus-official', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-1',
            officialUrl: 'https://example.com/events/event-1/',
            title: 'Event 1',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]),
    );
    const deps = createDeps(connector, false);
    const result = await runSourceSync(
      { connectorId: 'bootshaus-official', mode: 'apply', triggerType: 'scheduled' },
      deps,
    );
    expect(result.run.status).toBe('cancelled');
    expect(result.run.errorCategories).toContain('source_disabled');
  });

  it('records scheduled trigger metadata on successful dry path', async () => {
    const connector = new MockOfficialConnector('affenkaefig-official', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            connectorId: 'affenkaefig-official',
            sourceEventKey: 'event-ak',
            officialUrl: 'https://example.com/events/event-ak/',
            title: 'Event AK',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]),
    );
    const deps = createDeps(connector, true);
    deps.operationalConfig.register({
      connectorId: 'affenkaefig-official',
      sourceType: 'organizer',
      enabled: true,
      defaultIntervalMinutes: 360,
      maxConcurrency: 1,
      requestSpacingMs: 0,
      timeoutMs: 30_000,
      expectedMinParsedOnSuccess: 1,
    });
    const result = await runSourceSync(
      { connectorId: 'affenkaefig-official', mode: 'dry_run', triggerType: 'scheduled' },
      deps,
    );
    expect(result.run.triggerType).toBe('scheduled');
    expect(result.run.status).toBe('succeeded');
  });

  it('rejects overlapping same-source scheduled trigger', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const connector = new MockOfficialConnector('bootshaus-official', async () => {
      await gate;
      return buildRunResult([]);
    });
    const deps = createDeps(connector, true);
    const first = runSourceSync(
      { connectorId: 'bootshaus-official', mode: 'dry_run', triggerType: 'scheduled' },
      deps,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await runSourceSync(
      { connectorId: 'bootshaus-official', mode: 'dry_run', triggerType: 'scheduled' },
      deps,
    );
    expect(second.run.status).toBe('cancelled');
    expect(second.run.errorCategories).toContain('already_running');
    release?.();
    await first;
  });
});
