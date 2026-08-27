import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { officialEvidenceToEventCandidate } from '../../adapters/official-evidence-adapter';
import type { PlannerContext } from '../../planning/event-write-planner';
import { mapWithBoundedConcurrency } from '../concurrency';
import { classifyIngestionError, isRetryableErrorCategory } from '../error-taxonomy';
import { detectUnexpectedZeroResults } from '../health';
import {
  runSourceSync,
  simulateApplyExecution,
  type SyncOrchestratorDependencies,
} from '../orchestrator';
import { computeRetryDelayMs, DEFAULT_RETRY_POLICY, executeWithRetry } from '../retry-policy';
import { createInMemoryIngestionSyncPersistence } from '../run-persistence';
import { runBatchSourceSync } from '../runner';
import { createEmptySyncRunCounters } from '../types';

function buildEvidence(overrides: Partial<OfficialEventEvidence> & Pick<OfficialEventEvidence, 'sourceEventKey' | 'officialUrl' | 'title' | 'startsAt'>): OfficialEventEvidence {
  return {
    connectorId: 'mock-official',
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
  return {
    ...evidence,
    decision: 'preview_ready',
    reviewReasons: [],
  };
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
      capabilities: {
        listDiscovery: true,
        detailFetch: true,
        mediaEnrichment: false,
      },
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

function createTestDependencies(
  connector: MockOfficialConnector,
  options: {
    enabled?: boolean;
    expectedMinParsedOnSuccess?: number;
    loadPlannerContext?: (connectorId: string) => Promise<PlannerContext>;
    applyPlan?: SyncOrchestratorDependencies['applyPlan'];
    previousParsedCount?: number;
  } = {},
): SyncOrchestratorDependencies {
  const registry = new OfficialSourceRegistry();
  registry.register(connector);

  const operationalConfig = new SourceOperationalConfigRegistry();
  operationalConfig.register({
    connectorId: connector.metadata.connectorId,
    sourceType: 'venue_club',
    enabled: options.enabled ?? true,
    defaultIntervalMinutes: 360,
    maxConcurrency: 3,
    requestSpacingMs: 0,
    timeoutMs: 30_000,
    expectedMinParsedOnSuccess: options.expectedMinParsedOnSuccess ?? 5,
  });

  const persistence = createInMemoryIngestionSyncPersistence();
  if (options.previousParsedCount !== undefined) {
    void persistence.upsertHealth({
      connectorId: connector.metadata.connectorId,
      enabled: true,
      consecutiveFailures: 0,
      lastDiscoveredCount: options.previousParsedCount,
      lastParsedCount: options.previousParsedCount,
      lastAppliedCount: 0,
      healthStatus: 'healthy',
      lastSuccessAt: '2026-08-01T00:00:00.000Z',
    });
  }

  return {
    registry,
    operationalConfig,
    persistence,
    loadPlannerContext:
      options.loadPlannerContext ??
      (async () => ({
        existingSources: [],
        existingVenues: [],
        existingEvents: [],
        eventCatalog: [],
      })),
    applyPlan: options.applyPlan,
    createRunId: () => `test-run-${Math.random().toString(36).slice(2, 8)}`,
    now: () => new Date('2026-08-14T12:00:00.000Z'),
  };
}

describe('M8.4 sync orchestration', () => {
  beforeEach(() => {
    resetSourceOperationalConfigRegistryForTests();
  });

  it('A — successful dry run completes pipeline with zero consumer writes', async () => {
    const connector = new MockOfficialConnector('source-a', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-1',
            officialUrl: 'https://example.com/events/event-1/',
            title: 'Event One',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]),
    );

    const deps = createTestDependencies(connector);
    const result = await runSourceSync({ connectorId: 'source-a', mode: 'dry_run' }, deps);

    expect(result.run.status).toBe('succeeded');
    expect(result.run.mode).toBe('dry_run');
    expect(result.run.counters.parsed).toBe(1);
    expect(result.run.counters.appliedWrites).toBe(0);
    expect(result.run.counters.planned).toBe(1);
    expect(result.eventResults[0]?.outcome).toBe('planned_only');
  });

  it('B — successful apply simulation applies safe plans with correct counts', async () => {
    const connector = new MockOfficialConnector('source-b', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-b',
            officialUrl: 'https://example.com/events/event-b/',
            title: 'Event B',
            startsAt: '2027-08-21T22:00:00+02:00',
            descriptionClean: 'Description',
            lineupCandidates: [
              {
                displayName: 'DJ ONE',
                rawText: 'DJ ONE',
                billingOrder: 0,
                evidenceRole: 'headliner',
                evidenceOrigin: 'official_text',
              },
            ],
          }),
        ),
      ]),
    );

    let appliedCount = 0;
    const deps = createTestDependencies(connector, {
      applyPlan: async (plan) => {
        const execution = simulateApplyExecution(plan);
        if (execution.applied) {
          appliedCount += 1;
        }
        return execution;
      },
    });

    const result = await runSourceSync({ connectorId: 'source-b', mode: 'apply' }, deps);

    expect(result.run.status).toBe('succeeded');
    expect(result.run.counters.appliedWrites).toBe(1);
    expect(appliedCount).toBe(1);
    expect(result.eventResults[0]?.outcome).toBe('applied');
  });

  it('C — timeout then success retries and remains healthy', async () => {
    let attempts = 0;
    const connector = new MockOfficialConnector('source-c', async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('network timeout while fetching list');
      }
      return buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-c',
            officialUrl: 'https://example.com/events/event-c/',
            title: 'Event C',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]);
    });

    const deps = createTestDependencies(connector);
    const result = await runSourceSync({ connectorId: 'source-c', mode: 'dry_run' }, deps);

    expect(attempts).toBe(2);
    expect(result.run.retryCount).toBe(1);
    expect(result.run.status).toBe('succeeded');
    expect(result.health.healthStatus).toBe('healthy');
  });

  it('D — repeated failure stops after bounded retries and increments consecutiveFailures', async () => {
    const connector = new MockOfficialConnector('source-d', async () => {
      throw new Error('upstream 503 service unavailable');
    });

    const deps = createTestDependencies(connector);
    const first = await runSourceSync({ connectorId: 'source-d', mode: 'dry_run' }, deps);
    const second = await runSourceSync({ connectorId: 'source-d', mode: 'dry_run' }, deps);

    expect(first.run.status).toBe('failed');
    expect(first.run.retryCount).toBeGreaterThan(0);
    expect(second.health.consecutiveFailures).toBeGreaterThan(first.health.consecutiveFailures);
    expect(second.health.healthStatus).not.toBe('healthy');
  });

  it('E — HTTP 429 uses retry/backoff policy', async () => {
    const sleep = vi.fn(async () => undefined);
    let attempts = 0;

    const execution = await executeWithRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('HTTP 429 too many requests');
        }
        return 'ok';
      },
      { ...DEFAULT_RETRY_POLICY, maxAttempts: 3, initialDelayMs: 100 },
      sleep,
    );

    expect(execution.result).toBe('ok');
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(computeRetryDelayMs(1, DEFAULT_RETRY_POLICY)).toBe(250);
  });

  it('F — parser failure is not retried as network error', async () => {
    let attempts = 0;
    const connector = new MockOfficialConnector('source-f', async () => {
      attempts += 1;
      throw new Error('parser invariant failure on detail page');
    });

    const deps = createTestDependencies(connector);
    const result = await runSourceSync({ connectorId: 'source-f', mode: 'dry_run' }, deps);

    expect(attempts).toBe(1);
    expect(result.run.status).toBe('failed');
    expect(result.run.errorCategories).toContain('parser_degraded');
    expect(isRetryableErrorCategory('parser_degraded')).toBe(false);
    expect(['degraded', 'failing']).toContain(result.health.healthStatus);
  });

  it('G — identity ambiguity yields review_required without auto-binding', async () => {
    const connector = new MockOfficialConnector('source-g', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-g',
            officialUrl: 'https://example.com/events/event-g/',
            title: 'Rave Night',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]),
    );

    const deps = createTestDependencies(connector, {
      loadPlannerContext: async () => ({
        existingSources: [],
        existingVenues: [],
        existingEvents: [],
        eventCatalog: [
          {
            eventId: 'existing-g',
            title: 'Rave Night Special',
            startsAt: '2027-08-22T01:00:00+02:00',
            timezone: 'Europe/Berlin',
            venueCity: 'Köln',
            lineupBillingNames: [],
            sourceBindings: [],
          },
        ],
      }),
    });

    const result = await runSourceSync({ connectorId: 'source-g', mode: 'dry_run' }, deps);

    expect(result.run.counters.reviewRequired).toBeGreaterThan(0);
    expect(result.eventResults[0]?.outcome).toBe('review_required');
    expect(result.run.counters.appliedWrites).toBe(0);
  });

  it('H — zero-result anomaly degrades health without consumer deletes', async () => {
    const connector = new MockOfficialConnector('source-h', async () => buildRunResult([]));
    const deps = createTestDependencies(connector, { previousParsedCount: 30 });

    const result = await runSourceSync({ connectorId: 'source-h', mode: 'dry_run' }, deps);

    expect(detectUnexpectedZeroResults(result.run.counters, result.health, 5)).toBe(true);
    expect(result.run.errorCategories).toContain('unexpected_zero_results');
    expect(['degraded', 'failing']).toContain(result.health.healthStatus);
    expect(result.run.counters.appliedWrites).toBe(0);
  });

  it('I — partial success marks run partially_succeeded', async () => {
    const connector = new MockOfficialConnector('source-i', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'good',
            officialUrl: 'https://example.com/events/good/',
            title: 'Good Event',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
        buildPreview(
          buildEvidence({
            sourceEventKey: 'bad',
            officialUrl: 'https://bootshaus-club.ticket.io/bad/',
            title: 'Ticket Only',
            startsAt: '2027-08-22T22:00:00+02:00',
          }),
        ),
      ]),
    );

    const deps = createTestDependencies(connector);
    const result = await runSourceSync({ connectorId: 'source-i', mode: 'dry_run' }, deps);

    expect(result.run.status).toBe('partially_succeeded');
    expect(result.run.counters.planned).toBe(2);
    expect(result.run.counters.rejected).toBeGreaterThan(0);
    expect(result.run.counters.parsed).toBe(2);
  });

  it('J — disabled source does not execute connector run', async () => {
    let called = false;
    const connector = new MockOfficialConnector('source-j', async () => {
      called = true;
      return buildRunResult([]);
    });

    const deps = createTestDependencies(connector, { enabled: false });
    const result = await runSourceSync({ connectorId: 'source-j', mode: 'dry_run' }, deps);

    expect(called).toBe(false);
    expect(result.run.status).toBe('cancelled');
    expect(result.health.healthStatus).toBe('disabled');
  });

  it('K — dry-run safety keeps apply writes at zero', async () => {
    const connector = new MockOfficialConnector('source-k', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-k',
            officialUrl: 'https://example.com/events/event-k/',
            title: 'Event K',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]),
    );

    let applyCalls = 0;
    const deps = createTestDependencies(connector, {
      applyPlan: async () => {
        applyCalls += 1;
        throw new Error('applyPlan must not be called in dry_run mode');
      },
    });

    const result = await runSourceSync({ connectorId: 'source-k', mode: 'dry_run' }, deps);

    expect(applyCalls).toBe(0);
    expect(result.run.counters.appliedWrites).toBe(0);
  });

  it('L — ticket isolation keeps ticket mutations at zero during apply simulation', async () => {
    const connector = new MockOfficialConnector('source-l', async () =>
      buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-l',
            officialUrl: 'https://example.com/events/event-l/',
            title: 'Event L',
            startsAt: '2027-08-21T22:00:00+02:00',
            linkedTicketUrl: 'https://bootshaus-club.ticket.io/event-l/',
            lineupCandidates: [
              {
                displayName: 'ARTIST',
                rawText: 'ARTIST',
                billingOrder: 0,
                evidenceRole: 'headliner',
                evidenceOrigin: 'official_text',
              },
            ],
          }),
        ),
      ]),
    );

    const deps = createTestDependencies(connector, {
      applyPlan: async (plan) => simulateApplyExecution(plan),
    });

    const result = await runSourceSync({ connectorId: 'source-l', mode: 'apply' }, deps);
    expect(result.run.counters.appliedWrites).toBeGreaterThan(0);

    const candidate = officialEvidenceToEventCandidate(
      buildEvidence({
        sourceEventKey: 'event-l',
        officialUrl: 'https://example.com/events/event-l/',
        title: 'Event L',
        startsAt: '2027-08-21T22:00:00+02:00',
      }),
    );
    expect(candidate.tickets).toHaveLength(0);
  });
});

describe('M8.4 error taxonomy', () => {
  it('classifies retryable and non-retryable categories', () => {
    expect(classifyIngestionError(new Error('ETIMEDOUT')).category).toBe('network_timeout');
    expect(classifyIngestionError(new Error('HTTP 429')).category).toBe('rate_limited');
    expect(classifyIngestionError(new Error('parser invariant failure')).category).toBe('parser_degraded');
    expect(isRetryableErrorCategory('upstream_5xx')).toBe(true);
    expect(isRetryableErrorCategory('validation_rejected')).toBe(false);
  });
});

describe('M8.4 50-source scale simulation', () => {
  it('runs 50 mock sources with bounded concurrency and source isolation', async () => {
    const registry = new OfficialSourceRegistry();
    const operationalConfig = new SourceOperationalConfigRegistry();
    const persistence = createInMemoryIngestionSyncPersistence();

    for (let index = 0; index < 50; index += 1) {
      const connectorId = `mock-source-${index}`;
      const shouldFail = index % 7 === 0;
      const connector = new MockOfficialConnector(connectorId, async () => {
        if (shouldFail) {
          throw new Error('upstream 502 bad gateway');
        }
        return buildRunResult([
          buildPreview(
            buildEvidence({
              sourceEventKey: `${connectorId}-event`,
              officialUrl: `https://example.com/events/${connectorId}/`,
              title: `Event ${index}`,
              startsAt: '2027-08-21T22:00:00+02:00',
            }),
          ),
        ]);
      });
      registry.register(connector);
      operationalConfig.register({
        connectorId,
        sourceType: 'venue_club',
        enabled: true,
        defaultIntervalMinutes: 360,
        maxConcurrency: 5,
        requestSpacingMs: 0,
        timeoutMs: 30_000,
        expectedMinParsedOnSuccess: 1,
      });
    }

    const deps: SyncOrchestratorDependencies = {
      registry,
      operationalConfig,
      persistence,
      loadPlannerContext: async () => ({
        existingSources: [],
        existingVenues: [],
        existingEvents: [],
        eventCatalog: [],
      }),
      createRunId: () => `scale-${Math.random().toString(36).slice(2, 8)}`,
      now: () => new Date('2026-08-14T12:00:00.000Z'),
    };

    const startedAt = Date.now();
    const batch = await runBatchSourceSync(
      {
        connectorIds: Array.from({ length: 50 }, (_, index) => `mock-source-${index}`),
        mode: 'dry_run',
        triggerType: 'test',
        maxConcurrency: 5,
      },
      deps,
    );
    const durationMs = Date.now() - startedAt;

    expect(batch.results).toHaveLength(50);
    expect(batch.sourceIsolationFailures).toBe(0);
    expect(new Set(batch.results.map((result) => result.run.runId)).size).toBe(50);

    const succeeded = batch.results.filter((result) => result.run.status === 'succeeded').length;
    const failed = batch.results.filter((result) => result.run.status === 'failed').length;
    expect(succeeded).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
    expect(succeeded + failed).toBe(50);
    expect(durationMs).toBeLessThan(30_000);

    const counters = createEmptySyncRunCounters();
    for (const result of batch.results) {
      counters.appliedWrites += result.run.counters.appliedWrites;
    }
    expect(counters.appliedWrites).toBe(0);
  });

  it('mapWithBoundedConcurrency respects concurrency ceiling', async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithBoundedConcurrency(Array.from({ length: 20 }, (_, index) => index), 4, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return true;
    });

    expect(maxActive).toBeLessThanOrEqual(4);
  });
});

describe('M8.7 run overlap protection', () => {
  it('skips second concurrent trigger for the same connector', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const connector = new MockOfficialConnector('source-overlap', async () => {
      await firstGate;
      return buildRunResult([
        buildPreview(
          buildEvidence({
            sourceEventKey: 'event-overlap',
            officialUrl: 'https://example.com/events/event-overlap/',
            title: 'Overlap Event',
            startsAt: '2027-08-21T22:00:00+02:00',
          }),
        ),
      ]);
    });

    const deps = createTestDependencies(connector);
    const firstPromise = runSourceSync({ connectorId: 'source-overlap', mode: 'dry_run' }, deps);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await runSourceSync({ connectorId: 'source-overlap', mode: 'dry_run' }, deps);
    expect(second.run.status).toBe('cancelled');
    expect(second.run.errorCategories).toContain('already_running');

    releaseFirst?.();
    const first = await firstPromise;
    expect(first.run.status).toBe('succeeded');
  });
});
