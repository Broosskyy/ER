import type {
  EventBlockingKeyEntry,
  EventBlockingKeyRepository,
  EventMatchEvaluationRepository,
  EventMergeCandidate,
  EventMergeCandidateRepository,
  MultiSourceMatchEvaluation,
} from '../domain/matching-types';

export class InMemoryEventBlockingKeyRepository implements EventBlockingKeyRepository {
  private readonly entries: EventBlockingKeyEntry[] = [];

  async indexKeys(canonicalEventId: string, blockingKeys: string[]): Promise<EventBlockingKeyEntry[]> {
    const now = new Date().toISOString();
    const created: EventBlockingKeyEntry[] = [];
    for (const blockingKey of blockingKeys) {
      if (!blockingKey || blockingKey.endsWith(':')) {
        continue;
      }
      const existing = this.entries.find(
        (entry) => entry.canonicalEventId === canonicalEventId && entry.blockingKey === blockingKey,
      );
      if (existing) {
        created.push(existing);
        continue;
      }
      const entry: EventBlockingKeyEntry = {
        id: `bk-${canonicalEventId}-${blockingKey}`,
        canonicalEventId,
        blockingKey,
        createdAt: now,
      };
      this.entries.push(entry);
      created.push(entry);
    }
    return created;
  }

  async findCanonicalEventIdsByKeys(blockingKeys: string[]): Promise<string[]> {
    const keys = new Set(blockingKeys.filter((key) => key && !key.endsWith(':')));
    const matches = new Set<string>();
    for (const entry of this.entries) {
      if (keys.has(entry.blockingKey)) {
        matches.add(entry.canonicalEventId);
      }
    }
    return [...matches];
  }

  async listByCanonicalEventId(canonicalEventId: string): Promise<EventBlockingKeyEntry[]> {
    return this.entries.filter((entry) => entry.canonicalEventId === canonicalEventId);
  }
}

export class InMemoryEventMatchEvaluationRepository implements EventMatchEvaluationRepository {
  private readonly evaluations: MultiSourceMatchEvaluation[] = [];

  async create(evaluation: MultiSourceMatchEvaluation): Promise<MultiSourceMatchEvaluation> {
    this.evaluations.push({ ...evaluation });
    return evaluation;
  }

  async findByImportRecordId(importRecordId: string): Promise<MultiSourceMatchEvaluation | null> {
    return this.evaluations.find((entry) => entry.importRecordId === importRecordId) ?? null;
  }

  async listByCanonicalEventId(canonicalEventId: string, limit = 50): Promise<MultiSourceMatchEvaluation[]> {
    return this.evaluations
      .filter((entry) => entry.canonicalEventId === canonicalEventId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listBySourceId(sourceId: string, limit = 50): Promise<MultiSourceMatchEvaluation[]> {
    return this.evaluations
      .filter((entry) => entry.sourceId === sourceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listRecent(limit = 100): Promise<MultiSourceMatchEvaluation[]> {
    return [...this.evaluations]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}

export class InMemoryEventMergeCandidateRepository implements EventMergeCandidateRepository {
  private readonly candidates = new Map<string, EventMergeCandidate>();

  async upsert(candidate: EventMergeCandidate): Promise<EventMergeCandidate> {
    this.candidates.set(candidate.id, { ...candidate });
    return candidate;
  }

  async listByCanonicalEventId(canonicalEventId: string, limit = 50): Promise<EventMergeCandidate[]> {
    return [...this.candidates.values()]
      .filter((entry) => entry.canonicalEventId === canonicalEventId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listPending(limit = 100): Promise<EventMergeCandidate[]> {
    return [...this.candidates.values()]
      .filter((entry) => entry.status === 'pending')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}
