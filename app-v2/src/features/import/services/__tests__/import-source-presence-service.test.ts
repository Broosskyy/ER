import { describe, expect, it } from 'vitest';

import { ImportSourcePresenceService } from '@/features/import/services/import-source-presence-service';

describe('ImportSourcePresenceService', () => {
  const service = new ImportSourcePresenceService(3);

  it('marks seen references as active and resets missing count', () => {
    const updated = service.markSeen(
      {
        sourceId: 'source-1',
        externalEventId: 'ext-1',
        canonicalEventId: 'event-1',
        consecutiveMissingCount: 2,
        lastSeenAt: '2026-07-01T00:00:00.000Z',
        active: false,
      },
      '2026-07-15T00:00:00.000Z',
    );

    expect(updated.consecutiveMissingCount).toBe(0);
    expect(updated.active).toBe(true);
  });

  it('does not archive after a single missing import', () => {
    const evaluation = service.markMissing(
      {
        sourceId: 'source-1',
        externalEventId: 'ext-1',
        canonicalEventId: 'event-1',
        consecutiveMissingCount: 0,
        lastSeenAt: '2026-07-01T00:00:00.000Z',
        active: true,
      },
      '2026-07-15T00:00:00.000Z',
    );

    expect(evaluation.status).toBe('missing_once');
    expect(evaluation.shouldArchive).toBe(false);
  });

  it('requires review before archive threshold', () => {
    const evaluation = service.markMissing(
      {
        sourceId: 'source-1',
        externalEventId: 'ext-1',
        canonicalEventId: 'event-1',
        consecutiveMissingCount: 1,
        lastSeenAt: '2026-07-01T00:00:00.000Z',
        active: true,
        missingSince: '2026-07-10T00:00:00.000Z',
      },
      '2026-07-15T00:00:00.000Z',
    );

    expect(evaluation.status).toBe('missing_threshold');
    expect(evaluation.shouldReview).toBe(true);
    expect(evaluation.shouldArchive).toBe(false);
  });

  it('flags archive review after threshold', () => {
    const evaluation = service.markMissing(
      {
        sourceId: 'source-1',
        externalEventId: 'ext-1',
        canonicalEventId: 'event-1',
        consecutiveMissingCount: 2,
        lastSeenAt: '2026-07-01T00:00:00.000Z',
        active: true,
        missingSince: '2026-07-10T00:00:00.000Z',
      },
      '2026-07-15T00:00:00.000Z',
    );

    expect(evaluation.status).toBe('review_required');
    expect(evaluation.shouldArchive).toBe(true);
  });

  it('evaluates missing ids from import without deleting events', () => {
    const records = new Map([
      [
        'ext-1',
        {
          sourceId: 'source-1',
          externalEventId: 'ext-1',
          canonicalEventId: 'event-1',
          consecutiveMissingCount: 0,
          lastSeenAt: '2026-07-01T00:00:00.000Z',
          active: true,
        },
      ],
    ]);

    const evaluations = service.evaluateMissingFromImport(
      ['ext-1', 'ext-2'],
      ['ext-2'],
      records,
      '2026-07-15T00:00:00.000Z',
    );

    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.externalEventId).toBe('ext-1');
    expect(evaluations[0]?.shouldArchive).toBe(false);
  });
});
