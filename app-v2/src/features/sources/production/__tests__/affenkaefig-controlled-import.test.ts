import { describe, expect, it } from 'vitest';

import {
  compareAffenkaefigDryRunIdempotency,
  runAffenkaefigLiveFetch,
  simulateAffenkaefigControlledImport,
  summarizePublishReadiness,
} from '@/features/sources/production/affenkaefig-controlled-import';

const LIVE_TIMEOUT_MS = 180_000;

describe('Sprint 28.2 Affenkäfig controlled import (live)', () => {
  it('live fetch returns real events from affenkaefig.info', async () => {
    const report = await runAffenkaefigLiveFetch();
    expect(report.httpStatus).toBe(200);
    expect(report.finalUrl).toContain('affenkaefig.info');
    expect(report.strategy).toBe('event_detail_page');
    expect(report.detailPagesFetched).toBeGreaterThan(0);
    expect(report.eventCount).toBeGreaterThan(0);
    expect(report.validEventCount).toBeGreaterThan(0);
    expect(report.events.every((event) => event.externalId.includes('affenkaefig.info/event/'))).toBe(true);
    expect(report.events.every((event) => Boolean(event.title))).toBe(true);
    expect(report.events.every((event) => Boolean(event.startDate))).toBe(true);
  }, LIVE_TIMEOUT_MS);

  it('dry-run import classifies live events without fixture fallback', async () => {
    const report = await simulateAffenkaefigControlledImport({ runId: 'vitest-dry-run' });
    expect(report.eventCount).toBeGreaterThan(0);
    expect(report.inserts).toBeGreaterThan(0);
    expect(report.reviewsRequired).toBeGreaterThan(0);
    expect(report.events.every((event) => event.publishDecision !== 'publish')).toBe(true);
    expect(report.events.every((event) => ['certain', 'probable', 'uncertain'].includes(event.confidenceTier))).toBe(
      true,
    );

    const readiness = summarizePublishReadiness(report.events);
    expect(readiness.publishReady).toBe(0);
    expect(readiness.reviewRequired).toBeGreaterThan(0);
  }, LIVE_TIMEOUT_MS);

  it('repeated dry-run is idempotent on external IDs', async () => {
    const { comparison } = await compareAffenkaefigDryRunIdempotency();
    expect(comparison.firstRun.inserts).toBeGreaterThan(0);
    expect(comparison.secondRun.inserts).toBe(0);
    expect(comparison.secondRun.duplicates).toBe(0);
    expect(comparison.idempotent).toBe(true);
    expect(comparison.externalIdsStable).toBe(true);
  }, LIVE_TIMEOUT_MS * 2);
});
