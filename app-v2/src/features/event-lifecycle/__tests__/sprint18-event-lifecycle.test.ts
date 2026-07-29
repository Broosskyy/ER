import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  InMemoryEventLifecycleChangeRepository,
  InMemoryEventLifecycleHistoryRepository,
} from '../repositories/in-memory-lifecycle-repositories';
import { EventLifecycleChangeDetector } from '../services/event-lifecycle-change-detector';
import { EventLifecycleDecisionEngine } from '../services/event-lifecycle-decision-engine';
import { EventLifecycleEngine } from '../services/event-lifecycle-engine';
import { resolveLifecycleDecision } from '../domain/lifecycle-engine-config';

function baseEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-1',
    title: 'Techno Night',
    description: 'Original description',
    startDate: '2026-08-15T20:00:00.000Z',
    endDate: '2026-08-16T04:00:00.000Z',
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    ticketUrl: 'https://example.com/tickets',
    imageUrl: 'https://example.com/image-a.jpg',
    status: 'published',
    publishedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Sprint 18 Event Lifecycle Engine', () => {
  it('detects event creation', async () => {
    const historyRepository = new InMemoryEventLifecycleHistoryRepository();
    const changeRepository = new InMemoryEventLifecycleChangeRepository();
    const engine = new EventLifecycleEngine(
      new EventLifecycleChangeDetector(),
      new EventLifecycleDecisionEngine(),
      historyRepository,
      changeRepository,
    );

    const result = await engine.process({
      after: baseEvent({ id: 'evt-create' }),
      context: { sourceId: 'source-1', trustScore: 80 },
    });

    expect(result.evaluations[0]?.lifecycleEventType).toBe('event_created');
    expect(result.evaluations[0]?.decision).toBe('apply_immediately');
  });

  it('detects and versions field updates', async () => {
    const historyRepository = new InMemoryEventLifecycleHistoryRepository();
    const changeRepository = new InMemoryEventLifecycleChangeRepository();
    const engine = new EventLifecycleEngine(
      new EventLifecycleChangeDetector(),
      new EventLifecycleDecisionEngine(),
      historyRepository,
      changeRepository,
    );

    const before = baseEvent({ id: 'evt-update' });
    const after = baseEvent({ id: 'evt-update', description: 'Updated description' });

    const result = await engine.process({
      before,
      after,
      candidate: {
        externalId: 'ext-1',
        sourceId: 'source-1',
        sourceName: 'Source',
        title: after.title,
        description: after.description,
        startDate: after.startDate,
        rawSourceType: 'unknown',
      },
      context: { sourceId: 'source-1', trustScore: 80 },
    });

    expect(result.evaluations[0]?.changes.some((change) => change.fieldPath === 'description')).toBe(true);
    const history = await historyRepository.listByCanonicalEventId('evt-update');
    expect(history.length).toBe(1);
    const changes = await changeRepository.listByCanonicalEventId('evt-update');
    expect(changes.length).toBeGreaterThan(0);
  });

  it('requires review for critical date changes on published events with low trust', async () => {
    const evaluation = new EventLifecycleDecisionEngine().evaluate(
      baseEvent(),
      baseEvent({ startDate: '2026-08-16T20:00:00.000Z' }),
      [
        {
          fieldPath: 'startDate',
          oldValue: '2026-08-15T20:00:00.000Z',
          newValue: '2026-08-16T20:00:00.000Z',
          severity: 'critical',
          lifecycleEventType: 'event_moved',
        },
      ],
      { trustScore: 50 },
    );

    expect(evaluation.decision).toBe('review_required');
    expect(evaluation.lifecycleEventType).toBe('event_moved');
  });

  it('documents cancellation lifecycle event', async () => {
    const historyRepository = new InMemoryEventLifecycleHistoryRepository();
    const changeRepository = new InMemoryEventLifecycleChangeRepository();
    const engine = new EventLifecycleEngine(
      new EventLifecycleChangeDetector(),
      new EventLifecycleDecisionEngine(),
      historyRepository,
      changeRepository,
    );

    const before = baseEvent({ id: 'evt-cancel' });
    const after = baseEvent({ id: 'evt-cancel', cancelledAt: '2026-07-01T12:00:00.000Z' });

    const result = await engine.process({
      before,
      after,
      context: { sourceId: 'source-1', cancelled: true, trustScore: 90 },
    });

    expect(result.evaluations[0]?.lifecycleEventType).toBe('event_cancelled');
    expect(result.evaluations[0]?.changes.some((change) => change.fieldPath === 'cancelledAt')).toBe(true);
  });

  it('documents archive transitions', async () => {
    const historyRepository = new InMemoryEventLifecycleHistoryRepository();
    const changeRepository = new InMemoryEventLifecycleChangeRepository();
    const engine = new EventLifecycleEngine(
      new EventLifecycleChangeDetector(),
      new EventLifecycleDecisionEngine(),
      historyRepository,
      changeRepository,
    );

    const before = baseEvent({ id: 'evt-archive' });
    const after = baseEvent({ id: 'evt-archive', status: 'archived' });

    const result = await engine.process({
      before,
      after,
      context: { sourceId: 'source-1', trustScore: 80 },
    });

    expect(result.evaluations[0]?.lifecycleEventType).toBe('event_archived');
  });
});

describe('lifecycle config helpers', () => {
  it('routes critical published changes to review when trust is low', () => {
    expect(
      resolveLifecycleDecision({
        changeSeverity: 'critical',
        isPublished: true,
        trustScore: 50,
        hasExistingConflict: false,
        rule: {
          fieldPath: 'startDate',
          severity: 'critical',
          reviewOnPublished: true,
          minTrustScoreForAutoApply: 85,
        },
      }),
    ).toBe('review_required');
  });
});
