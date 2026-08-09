import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  isEventInCanary,
  publishFieldsNormalizedEqual,
  patchHasApplicableChanges,
} from '@/features/import/generic-truth-pipeline';
import { resolveServerGenericTruthRollout } from '@/features/import/generic-truth-pipeline/server-rollout-config';

function event(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-noop-001',
    title: 'Fixture Event',
    description: 'Body',
    startDate: '2026-09-15T20:00:00.000Z',
    priceText: 'ab 15,00 €',
    ticketUrl: 'https://shop.example-events.test/t/1',
    status: 'published',
    sourceId: 'source-fixture',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('field delta normalization', () => {
  it('treats equivalent ISO dates as equal', () => {
    expect(
      publishFieldsNormalizedEqual('startDate', '2026-09-15T20:00:00.000Z', '2026-09-15T20:00:00+00:00'),
    ).toBe(true);
  });

  it('treats normalized equivalent prices as equal', () => {
    expect(publishFieldsNormalizedEqual('priceText', 'ab 15,00 €', 'ab 15,00€')).toBe(true);
  });

  it('detects no applicable patch when values match', () => {
    const existing = event();
    const patch = {
      title: existing.title,
      startDate: existing.startDate,
      priceText: existing.priceText,
      ticketUrl: existing.ticketUrl,
    };
    expect(patchHasApplicableChanges(existing, patch, {})).toBe(false);
  });
});

describe('deterministic canary', () => {
  it('uses sourceId and canonicalEventId for stable cohorts', () => {
    const config = resolveServerGenericTruthRollout({
      canaryPercent: 50,
      enabled: true,
      mode: 'controlled',
      sourceAllowlist: ['source-a'],
    });
    const first = isEventInCanary('source-a', 'evt-stable-001', config);
    const second = isEventInCanary('source-a', 'evt-stable-001', config);
    expect(first).toBe(second);
  });

  it('selects all events at 100 percent and none at 0', () => {
    const all = resolveServerGenericTruthRollout({ canaryPercent: 100, enabled: true });
    const none = resolveServerGenericTruthRollout({ canaryPercent: 0, enabled: true });
    expect(isEventInCanary('source-a', 'evt-1', all)).toBe(true);
    expect(isEventInCanary('source-a', 'evt-1', none)).toBe(false);
  });
});
