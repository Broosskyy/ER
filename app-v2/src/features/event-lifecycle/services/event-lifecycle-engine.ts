import type {
  EventLifecycleChangeRepository,
  EventLifecycleHistoryRepository,
  EventLifecycleProcessInput,
  EventLifecycleProcessResult,
} from '../domain/lifecycle-engine-types';
import { EventLifecycleChangeDetector } from './event-lifecycle-change-detector';
import { EventLifecycleDecisionEngine } from './event-lifecycle-decision-engine';

function createHistoryId(): string {
  return `history-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createChangeId(): string {
  return `change-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class EventLifecycleEngine {
  constructor(
    private readonly changeDetector: EventLifecycleChangeDetector,
    private readonly decisionEngine: EventLifecycleDecisionEngine,
    private readonly historyRepository: EventLifecycleHistoryRepository,
    private readonly changeRepository: EventLifecycleChangeRepository,
  ) {}

  async process(input: EventLifecycleProcessInput): Promise<EventLifecycleProcessResult> {
    const changes = this.changeDetector.detect(
      input.before,
      input.after,
      input.candidate,
      {
        cancelled: input.context?.cancelled,
        postponed: input.context?.postponed,
      },
    );

    const evaluation = this.decisionEngine.evaluate(
      input.before,
      input.after,
      changes,
      input.context,
    );

    const canonicalEventId = input.after.canonicalEventId ?? input.after.id;
    let event = { ...input.after };
    const appliedChanges: typeof changes = [];
    let queuedForReview = false;
    let conflictsCreated = 0;

    if (evaluation.decision === 'ignore') {
      return {
        event,
        evaluations: [evaluation],
        appliedChanges,
        queuedForReview,
        conflictsCreated,
      };
    }

    const historyId = createHistoryId();
    await this.historyRepository.create({
      id: historyId,
      canonicalEventId,
      lifecycleEventType: evaluation.lifecycleEventType,
      decision: evaluation.decision,
      sourceId: evaluation.sourceId,
      importJobId: evaluation.importJobId,
      importRecordId: evaluation.importRecordId,
      confidenceScore: evaluation.confidenceScore,
      lifecycleStatusBefore: evaluation.lifecycleStatusBefore,
      lifecycleStatusAfter: evaluation.lifecycleStatusAfter,
      changeCount: changes.length,
      metadata: {
        reasons: evaluation.reasons,
      },
      createdAt: evaluation.createdAt,
    });

    await this.changeRepository.createMany(
      changes.map((change) => ({
        id: createChangeId(),
        historyId,
        canonicalEventId,
        fieldPath: change.fieldPath,
        oldValue: change.oldValue,
        newValue: change.newValue,
        severity: change.severity,
        provenanceSourceId: evaluation.sourceId,
        createdAt: evaluation.createdAt,
      })),
    );

    if (evaluation.decision === 'apply_immediately') {
      for (const change of changes) {
        if (change.fieldPath === 'id') {
          continue;
        }
        event = {
          ...event,
          [change.fieldPath]: change.newValue,
        } as typeof event;
        appliedChanges.push(change);
      }
    } else if (evaluation.decision === 'review_required') {
      queuedForReview = true;
    } else if (evaluation.decision === 'create_conflict') {
      conflictsCreated = changes.length;
      queuedForReview = true;
    }

    return {
      event,
      evaluations: [evaluation],
      appliedChanges,
      queuedForReview,
      conflictsCreated,
    };
  }
}
