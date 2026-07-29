import type { SourceReference } from '@/features/aggregation/identity/event-identity';
import type {
  DuplicateDecisionRepository,
  EventConflictRepository,
  EventSourceReferenceRepository,
  FieldProvenanceRepository,
  Page,
} from '@/features/aggregation/repositories/multi-source-repositories';
import type { DuplicateDecision, EventConflict, FieldProvenance } from '@/features/aggregation/merge/event-conflict';

class InMemorySourceReferences implements EventSourceReferenceRepository {
  private readonly rows = new Map<string, SourceReference & { id: string; canonicalEventId: string }>();

  async create(reference: SourceReference & { id: string; canonicalEventId: string }) {
    return this.upsert(reference);
  }

  async createMany(references: (SourceReference & { id: string; canonicalEventId: string })[]) {
    return Promise.all(references.map((reference) => this.upsert(reference)));
  }

  async findByCanonicalEventId(canonicalEventId: string) {
    return [...this.rows.values()].filter((row) => row.canonicalEventId === canonicalEventId);
  }

  async findBySourceId(sourceId: string) {
    return [...this.rows.values()].filter((row) => row.sourceId === sourceId);
  }

  async findByExternalEventId(sourceId: string, externalEventId: string) {
    return (
      [...this.rows.values()].find(
        (row) => row.sourceId === sourceId && row.externalEventId === externalEventId,
      ) ?? null
    );
  }

  async upsert(reference: SourceReference & { id: string; canonicalEventId: string }) {
    const key = `${reference.sourceId}:${reference.externalEventId}`;
    this.rows.set(key, { ...reference });
    return reference;
  }

  async markInactive() {}

  async updateLastSeen() {}

  async listPaginated(): Promise<Page<SourceReference>> {
    return { items: [...this.rows.values()], total: this.rows.size, page: 1, pageSize: 50 };
  }
}

class InMemoryFieldProvenance implements FieldProvenanceRepository {
  private readonly rows = new Map<string, FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string }>();

  async upsertFieldSelection(provenance: FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string }) {
    const key = `${provenance.canonicalEventId}:${provenance.fieldPath}`;
    this.rows.set(key, { ...provenance });
    return provenance;
  }

  async findByCanonicalEventId(canonicalEventId: string) {
    return [...this.rows.values()].filter((row) => row.canonicalEventId === canonicalEventId);
  }

  async findByFieldPath(canonicalEventId: string, fieldPath: string) {
    return this.rows.get(`${canonicalEventId}:${fieldPath}`) ?? null;
  }

  async listAlternatives(canonicalEventId: string, fieldPath: string) {
    return (await this.findByFieldPath(canonicalEventId, fieldPath))?.alternatives ?? [];
  }

  async setManualOverride(): Promise<FieldProvenance> {
    throw new Error('not implemented');
  }

  async clearManualOverride() {}
}

class InMemoryConflicts implements EventConflictRepository {
  async create(conflict: EventConflict) {
    return conflict;
  }
  async createMany(conflicts: EventConflict[]) {
    return conflicts;
  }
  async findById() {
    return null;
  }
  async findByCanonicalEventId() {
    return [];
  }
  async listPaginated() {
    return { items: [], total: 0, page: 1, pageSize: 50 };
  }
  async resolve() {}
  async listUnresolved() {
    return [];
  }
  async reopen() {}
}

class InMemoryDuplicateDecisions implements DuplicateDecisionRepository {
  async createDecision(decision: DuplicateDecision) {
    return decision;
  }
  async findByCandidateIds() {
    return null;
  }
  async findByCanonicalEventId() {
    return [];
  }
  async listPaginated() {
    return { items: [], total: 0, page: 1, pageSize: 50 };
  }
  async reverseDecision() {}
  async findActiveKeptSeparateDecision() {
    return null;
  }
}

export class InMemoryMultiSourceRepositories {
  readonly sourceReferences = new InMemorySourceReferences();
  readonly fieldProvenance = new InMemoryFieldProvenance();
  readonly conflicts = new InMemoryConflicts();
  readonly duplicateDecisions = new InMemoryDuplicateDecisions();
}
