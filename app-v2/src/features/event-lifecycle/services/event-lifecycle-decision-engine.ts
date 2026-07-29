import type { AdminEventRecord } from '@/data/types/records';
import { EventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import type { EventLifecycleInput } from '@/features/events/lifecycle/lifecycle-types';
import { resolveLifecycleDecision, resolveLifecycleFieldRule } from '../domain/lifecycle-engine-config';
import type {
  EventLifecycleContext,
  EventLifecycleEvaluation,
  EventLifecycleFieldChange,
  LifecycleDecision,
  LifecycleEventType,
} from '../domain/lifecycle-engine-types';

function createEvaluationId(): string {
  return `lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toLifecycleInput(record: AdminEventRecord): EventLifecycleInput {
  return {
    editorialStatus: record.status,
    timezone: record.timezone ?? 'Europe/Berlin',
    startAt: record.startDate,
    endAt: record.endDate,
    doorsOpenAt: record.doorsOpenAt,
    salesStartAt: record.salesStartAt,
    salesEndAt: record.salesEndAt,
    cancelledAt: record.cancelledAt,
    postponedAt: record.postponedAt,
    publishedAt: record.publishedAt,
  };
}

function primaryLifecycleEventType(changes: EventLifecycleFieldChange[]): LifecycleEventType {
  const priority: LifecycleEventType[] = [
    'event_created',
    'event_cancelled',
    'event_archived',
    'event_reactivated',
    'event_postponed',
    'event_moved',
    'venue_changed',
    'lineup_changed',
    'event_updated',
  ];
  for (const type of priority) {
    if (changes.some((change) => change.lifecycleEventType === type)) {
      return type;
    }
  }
  return changes[0]?.lifecycleEventType ?? 'event_updated';
}

export class EventLifecycleDecisionEngine {
  constructor(private readonly lifecycleResolver = new EventLifecycleResolver()) {}

  evaluate(
    before: AdminEventRecord | null | undefined,
    after: AdminEventRecord,
    changes: EventLifecycleFieldChange[],
    context: EventLifecycleContext = {},
  ): EventLifecycleEvaluation {
    const now = new Date().toISOString();
    const isPublished = (before?.status ?? after.status) === 'published';
    const trustScore = context.trustScore ?? 70;
    const lifecycleStatusBefore = before
      ? this.lifecycleResolver.resolve(toLifecycleInput(before)).status
      : undefined;
    const lifecycleStatusAfter = this.lifecycleResolver.resolve(toLifecycleInput(after)).status;

    if (changes.length === 0) {
      return {
        id: createEvaluationId(),
        canonicalEventId: after.canonicalEventId ?? after.id,
        lifecycleEventType: 'event_updated',
        decision: 'ignore',
        changes: [],
        confidenceScore: context.confidenceScore ?? 0,
        lifecycleStatusBefore,
        lifecycleStatusAfter,
        reasons: ['No lifecycle changes detected.'],
        sourceId: context.sourceId,
        importJobId: context.importJobId,
        importRecordId: context.importRecordId,
        createdAt: now,
      };
    }

    let decision: LifecycleDecision = 'apply_immediately';
    const reasons: string[] = [];

    for (const change of changes) {
      const rule = resolveLifecycleFieldRule(change.fieldPath);
      const changeDecision = resolveLifecycleDecision({
        changeSeverity: change.severity,
        isPublished,
        trustScore,
        hasExistingConflict: false,
        rule,
      });
      if (changeDecision === 'create_conflict') {
        decision = 'create_conflict';
      } else if (changeDecision === 'review_required' && decision !== 'create_conflict') {
        decision = 'review_required';
      }
      reasons.push(`${change.fieldPath}: ${change.lifecycleEventType}`);
    }

    return {
      id: createEvaluationId(),
      canonicalEventId: after.canonicalEventId ?? after.id,
      lifecycleEventType: primaryLifecycleEventType(changes),
      decision,
      changes,
      confidenceScore: context.confidenceScore ?? trustScore,
      lifecycleStatusBefore,
      lifecycleStatusAfter,
      reasons,
      sourceId: context.sourceId,
      importJobId: context.importJobId,
      importRecordId: context.importRecordId,
      createdAt: now,
    };
  }
}

export const eventLifecycleDecisionEngine = new EventLifecycleDecisionEngine();
