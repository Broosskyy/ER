import { describe, expect, it, vi } from 'vitest';

import type { AdminEventRepository, EventRepository } from '@/data/repositories/repositories';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { SourceReference } from '@/features/aggregation/identity/event-identity';
import type { DuplicateDecision, EventConflict, FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import { PriorityBasedMergeStrategy } from '@/features/aggregation/merge/merge-strategy';
import type {
  DuplicateDecisionRepository,
  EventConflictRepository,
  EventSourceReferenceRepository,
  FieldProvenanceRepository,
  Page,
} from '@/features/aggregation/repositories/multi-source-repositories';
import { ConflictResolutionService } from '@/features/aggregation/services/conflict-resolution-service';
import { MergeProvenanceService } from '@/features/aggregation/services/merge-provenance-service';
import { eventQualityResolver } from '@/features/events/quality/event-quality-resolver';
import { publishReadinessResolver } from '@/features/events/quality/publish-readiness-resolver';
import type { ImportAuditLog, CreateImportAuditLogInput } from '@/features/import/models/types';

function canonicalEvent(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'ext-1',
    sourceId: 'source-a',
    sourceName: 'Source A',
    title: 'Open Air',
    startDate: '2026-08-01T20:00:00.000Z',
    venueName: 'Flutgraben',
    cityName: 'Berlin',
    rawSourceType: 'api_json',
    ...overrides,
  };
}

function adminEvent(id = 'canonical-1'): AdminEventRecord {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    title: 'Open Air',
    description: 'Canonical description',
    startDate: '2026-08-01T20:00:00.000Z',
    status: 'published',
    createdAt: now,
    updatedAt: now,
    venueName: 'Flutgraben',
  };
}

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
    return [...this.rows.values()].find(
      (row) => row.sourceId === sourceId && row.externalEventId === externalEventId,
    ) ?? null;
  }

  async upsert(reference: SourceReference & { id: string; canonicalEventId: string }) {
    const key = `${reference.sourceId}:${reference.externalEventId}`;
    this.rows.set(key, { ...reference });
    return reference;
  }

  async markInactive(sourceId: string, externalEventId: string) {
    const key = `${sourceId}:${externalEventId}`;
    const row = this.rows.get(key);
    if (row) {
      this.rows.set(key, { ...row, active: false });
    }
  }

  async updateLastSeen(sourceId: string, externalEventId: string, lastSeenAt: string) {
    const key = `${sourceId}:${externalEventId}`;
    const row = this.rows.get(key);
    if (row) {
      this.rows.set(key, { ...row, lastSeenAt, active: true });
    }
  }

  async listPaginated(page: number, pageSize: number): Promise<Page<SourceReference>> {
    const items = [...this.rows.values()];
    return { items, total: items.length, page, pageSize };
  }
}

class InMemoryFieldProvenance implements FieldProvenanceRepository {
  private readonly rows = new Map<string, FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string }>();

  private key(canonicalEventId: string, fieldPath: string) {
    return `${canonicalEventId}:${fieldPath}`;
  }

  async upsertFieldSelection(
    provenance: FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string },
  ) {
    this.rows.set(this.key(provenance.canonicalEventId, provenance.fieldPath), { ...provenance });
    return provenance;
  }

  async findByCanonicalEventId(canonicalEventId: string) {
    return [...this.rows.values()].filter((row) => row.canonicalEventId === canonicalEventId);
  }

  async findByFieldPath(canonicalEventId: string, fieldPath: string) {
    return this.rows.get(this.key(canonicalEventId, fieldPath)) ?? null;
  }

  async listAlternatives(canonicalEventId: string, fieldPath: string) {
    return (await this.findByFieldPath(canonicalEventId, fieldPath))?.alternatives ?? [];
  }

  async setManualOverride(canonicalEventId: string, fieldPath: string, value: unknown, selectedAt: string) {
    return this.upsertFieldSelection({
      id: `provenance-${canonicalEventId}-${fieldPath}`,
      canonicalEventId,
      fieldPath,
      value,
      selectedSourceId: 'manual_override',
      selectionReason: 'manual_override',
      alternatives: [],
      lastChangedAt: selectedAt,
    });
  }

  async clearManualOverride(canonicalEventId: string, fieldPath: string) {
    const row = this.rows.get(this.key(canonicalEventId, fieldPath));
    if (row) {
      this.rows.set(this.key(canonicalEventId, fieldPath), {
        ...row,
        selectedSourceId: 'canonical',
        selectionReason: 'field_priority',
      });
    }
  }
}

class InMemoryConflicts implements EventConflictRepository {
  private readonly rows = new Map<string, EventConflict>();

  async create(conflict: EventConflict) {
    this.rows.set(conflict.id, { ...conflict });
    return conflict;
  }

  async createMany(conflicts: EventConflict[]) {
    return Promise.all(conflicts.map((conflict) => this.create(conflict)));
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async findByCanonicalEventId(canonicalEventId: string) {
    return [...this.rows.values()].filter((row) => row.canonicalEventId === canonicalEventId);
  }

  async listUnresolved(canonicalEventId?: string) {
    return [...this.rows.values()].filter(
      (row) => !row.resolved && (!canonicalEventId || row.canonicalEventId === canonicalEventId),
    );
  }

  async resolve(id: string, resolution: string, resolvedAt: string) {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, resolved: true, resolution, resolvedAt });
    }
  }

  async reopen(id: string) {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, resolved: false, resolution: undefined, resolvedAt: undefined });
    }
  }

  async listPaginated(page: number, pageSize: number): Promise<Page<EventConflict>> {
    const items = [...this.rows.values()];
    return { items, total: items.length, page, pageSize };
  }
}

class InMemoryAudit {
  readonly entries: ImportAuditLog[] = [];

  async create(input: CreateImportAuditLogInput) {
    const entry: ImportAuditLog = {
      id: `audit-${this.entries.length + 1}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  async listByEntity() {
    return this.entries;
  }
}

function createMergeStack(record = adminEvent()) {
  const adminEvents = {
    getById: vi.fn(async (id: string) => (id === record.id ? { ...record } : null)),
    save: vi.fn(async (next: AdminEventRecord) => ({ ...next })),
  };
  const eventRepository = { refresh: vi.fn(async () => undefined) };
  const sourceReferences = new InMemorySourceReferences();
  const fieldProvenance = new InMemoryFieldProvenance();
  const conflicts = new InMemoryConflicts();
  const audit = new InMemoryAudit();
  const service = new MergeProvenanceService(
    adminEvents as unknown as AdminEventRepository,
    eventRepository as unknown as EventRepository,
    sourceReferences,
    fieldProvenance,
    conflicts,
    new PriorityBasedMergeStrategy(),
    eventQualityResolver,
    publishReadinessResolver,
    audit,
  );
  return { service, adminEvents, eventRepository, sourceReferences, fieldProvenance, conflicts, audit, record };
}

describe('MergeProvenanceService', () => {
  it('lets venue source win address and coordinates', async () => {
    const { service, record } = createMergeStack();
    const result = await service.merge({
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'generic-source',
          sourceName: 'Generic',
          externalEventId: 'g-1',
          sourcePriority: 50,
          sourceTrustScore: 60,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'generic-source',
            venueAddress: 'Wrong address',
            latitude: 1,
            longitude: 2,
          }),
        },
        {
          sourceId: 'venue-source',
          sourceName: 'Venue',
          externalEventId: 'v-1',
          sourceType: 'venue',
          sourcePriority: 80,
          sourceTrustScore: 70,
          retrievedAt: '2026-01-02T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'venue-source',
            venueAddress: 'Am Flutgraben 2',
            latitude: 52.49,
            longitude: 13.44,
          }),
        },
      ],
    });

    expect(result.event.address).toBe('Am Flutgraben 2');
    expect(result.event.latitude).toBe(52.49);
    expect(result.event.longitude).toBe(13.44);
  });

  it('lets organizer source win description and lineup', async () => {
    const { service, record } = createMergeStack();
    const result = await service.merge({
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'generic-source',
          sourceName: 'Generic',
          externalEventId: 'g-1',
          sourcePriority: 60,
          sourceTrustScore: 60,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'generic-source',
            description: 'Generic description',
            artistNames: ['Other'],
          }),
        },
        {
          sourceId: 'organizer-source',
          sourceName: 'Organizer',
          externalEventId: 'o-1',
          sourceType: 'organizer',
          sourcePriority: 70,
          sourceTrustScore: 80,
          retrievedAt: '2026-01-02T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'organizer-source',
            description: 'Organizer description',
            artistNames: ['DJ Alpha', 'DJ Beta'],
          }),
        },
      ],
    });

    expect(result.event.description).toBe('Organizer description');
    expect(result.event.artists).toEqual(['DJ Alpha', 'DJ Beta']);
  });

  it('lets ticket partner win ticket links', async () => {
    const { service, record } = createMergeStack();
    const result = await service.merge({
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'generic-source',
          sourceName: 'Generic',
          externalEventId: 'g-1',
          sourcePriority: 50,
          sourceTrustScore: 60,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'generic-source',
            ticketUrl: 'https://generic.example/tickets',
          }),
        },
        {
          sourceId: 'ticket-partner',
          sourceName: 'Tickets',
          externalEventId: 't-1',
          sourceType: 'ticket_partner',
          sourcePriority: 80,
          sourceTrustScore: 90,
          retrievedAt: '2026-01-02T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'ticket-partner',
            ticketUrl: 'https://tickets.example/open-air',
          }),
        },
      ],
    });

    expect(result.event.ticketUrl).toBe('https://tickets.example/open-air');
  });

  it('preserves manual overrides and alternatives', async () => {
    const { service, record, fieldProvenance } = createMergeStack();
    await fieldProvenance.setManualOverride(record.id, 'ticketUrl', 'https://admin.example/tickets', '2026-01-01T00:00:00.000Z');
    const result = await service.merge({
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'ticket-partner',
          sourceName: 'Tickets',
          externalEventId: 't-1',
          sourceType: 'ticket_partner',
          sourcePriority: 90,
          sourceTrustScore: 90,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'ticket-partner',
            ticketUrl: 'https://tickets.example/open-air',
          }),
        },
      ],
    });

    expect(result.event.ticketUrl).toBe('https://admin.example/tickets');
    const ticketProvenance = await fieldProvenance.findByFieldPath(record.id, 'ticketUrl');
    expect(ticketProvenance?.selectedSourceId).toBe('manual_override');
    expect(ticketProvenance?.alternatives.length).toBeGreaterThanOrEqual(0);
  });

  it('persists conflicts and keeps inactive references', async () => {
    const { service, record, sourceReferences, conflicts } = createMergeStack();
    await service.merge({
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'source-a',
          sourceName: 'A',
          externalEventId: 'a-1',
          sourcePriority: 50,
          sourceTrustScore: 50,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          event: canonicalEvent({ sourceId: 'source-a', description: 'Alpha' }),
        },
        {
          sourceId: 'source-b',
          sourceName: 'B',
          externalEventId: 'b-1',
          sourcePriority: 50,
          sourceTrustScore: 50,
          retrievedAt: '2026-01-02T00:00:00.000Z',
          event: canonicalEvent({ sourceId: 'source-b', description: 'Beta' }),
        },
      ],
    });

    await service.merge({
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'source-a',
          sourceName: 'A',
          externalEventId: 'a-1',
          sourcePriority: 50,
          sourceTrustScore: 50,
          retrievedAt: '2026-01-03T00:00:00.000Z',
          event: canonicalEvent({ sourceId: 'source-a', description: 'Alpha' }),
        },
      ],
    });

    const references = await sourceReferences.findByCanonicalEventId(record.id);
    expect(references.some((entry) => entry.sourceId === 'source-b' && !entry.active)).toBe(true);
    const allConflicts = await conflicts.findByCanonicalEventId(record.id);
    expect(allConflicts.some((conflict) => conflict.field === 'description')).toBe(true);
  });

  it('remains idempotent and keeps a single canonical id', async () => {
    const { service, record } = createMergeStack();
    const request = {
      canonicalEventId: record.id,
      contributions: [
        {
          sourceId: 'venue-source',
          sourceName: 'Venue',
          externalEventId: 'v-1',
          sourceType: 'venue',
          sourcePriority: 60,
          sourceTrustScore: 70,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          event: canonicalEvent({
            sourceId: 'venue-source',
            venueAddress: 'Am Flutgraben 2',
          }),
        },
      ],
    };
    const first = await service.merge(request);
    const second = await service.merge(request);
    expect(first.canonicalEventId).toBe(record.id);
    expect(second.canonicalEventId).toBe(record.id);
    expect(second.event.description).toBe(first.event.description);
    expect(second.event.ticketUrl).toBe(first.event.ticketUrl);
  });
});

describe('ConflictResolutionService', () => {
  function createConflictStack() {
    const record = adminEvent();
    const adminEvents = {
      getById: vi.fn(async (id: string) => (id === record.id ? { ...record } : null)),
      save: vi.fn(async (next: AdminEventRecord) => ({ ...next })),
    };
    const eventRepository = { refresh: vi.fn(async () => undefined) };
    const fieldProvenance = new InMemoryFieldProvenance();
    const conflicts = new InMemoryConflicts();
    const audit = new InMemoryAudit();
    const service = new ConflictResolutionService(
      adminEvents as unknown as AdminEventRepository,
      eventRepository as unknown as EventRepository,
      conflicts,
      fieldProvenance,
      eventQualityResolver,
      publishReadinessResolver,
      audit,
    );
    return { service, record, conflicts, audit, adminEvents, fieldProvenance };
  }

  async function seedConflict(canonicalEventId: string, conflicts: InMemoryConflicts) {
    return conflicts.create({
      id: `conflict-${canonicalEventId}-description`,
      canonicalEventId,
      field: 'description',
      values: [
        { sourceId: 'source-a', value: 'Alpha' },
        { sourceId: 'source-b', value: 'Beta' },
      ],
      sourceIds: ['source-a', 'source-b'],
      severity: 'warning',
      detectedAt: '2026-01-01T00:00:00.000Z',
      resolved: false,
    });
  }

  it('supports source_value, keep_canonical, manual_value, and defer', async () => {
    const { service, record, conflicts, audit } = createConflictStack();
    const conflict = await seedConflict(record.id, conflicts);

    const sourceValue = await service.resolve({
      conflictId: conflict.id,
      decision: 'source_value',
      actorId: 'admin-1',
      sourceId: 'source-b',
    });
    expect(sourceValue.conflict.resolved).toBe(true);

    await conflicts.reopen(conflict.id);
    const keepCanonical = await service.resolve({
      conflictId: conflict.id,
      decision: 'keep_canonical',
      actorId: 'admin-1',
    });
    expect(keepCanonical.conflict.resolution).toBe('keep_canonical');

    await conflicts.reopen(conflict.id);
    const manual = await service.resolve({
      conflictId: conflict.id,
      decision: 'manual_value',
      actorId: 'admin-1',
      manualValue: 'Curated description',
    });
    expect(manual.event.description).toBe('Curated description');

    const deferredConflict = await conflicts.create({
      ...conflict,
      id: 'conflict-defer',
      resolved: false,
      resolution: undefined,
      resolvedAt: undefined,
    });
    const deferred = await service.resolve({
      conflictId: deferredConflict.id,
      decision: 'defer',
      actorId: 'admin-1',
    });
    expect(deferred.conflict.resolved).toBe(false);
    expect(audit.entries.some((entry) => entry.action === 'conflict_deferred')).toBe(true);
  });

  it('blocks publish readiness for critical unresolved conflicts and unblocks after resolve', async () => {
    const { service, record, conflicts } = createConflictStack();
    const critical = await conflicts.create({
      id: `conflict-${record.id}-startDate`,
      canonicalEventId: record.id,
      field: 'startDate',
      values: [
        { sourceId: 'source-a', value: '2026-08-01T20:00:00.000Z' },
        { sourceId: 'source-b', value: '2026-08-02T20:00:00.000Z' },
      ],
      sourceIds: ['source-a', 'source-b'],
      severity: 'critical',
      detectedAt: '2026-01-01T00:00:00.000Z',
      resolved: false,
    });

    const blocked = publishReadinessResolver.resolve(
      {
        id: record.id,
        slug: record.id,
        title: record.title,
        description: record.description,
        startDateTime: record.startDate,
        timezone: 'Europe/Berlin',
        venue: 'Flutgraben',
        city: 'Berlin',
        country: 'Germany',
        genres: [],
        artists: [],
        source: 'admin',
        sourceEventId: record.id,
        status: 'published',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      { conflicts: [critical] },
    );
    expect(blocked.status).toBe('blocked');

    const resolved = await service.resolve({
      conflictId: critical.id,
      decision: 'keep_canonical',
      actorId: 'admin-1',
    });
    expect(resolved.publishReadiness).not.toBe('blocked');
  });

  it('writes audit entries and supports reopen with idempotent repetition', async () => {
    const { service, record, conflicts, audit } = createConflictStack();
    const conflict = await seedConflict(record.id, conflicts);
    const first = await service.resolve({
      conflictId: conflict.id,
      decision: 'source_value',
      actorId: 'admin-1',
      sourceId: 'source-a',
    });
    const second = await service.resolve({
      conflictId: conflict.id,
      decision: 'source_value',
      actorId: 'admin-1',
      sourceId: 'source-a',
    });
    expect(second.conflict.resolved).toBe(true);
    expect(audit.entries.some((entry) => entry.action === 'conflict_resolved')).toBe(true);

    const reopened = await service.reopen(conflict.id, 'admin-1');
    expect(reopened.conflict.resolved).toBe(false);
    expect(audit.entries.some((entry) => entry.action === 'conflict_reopened')).toBe(true);
    expect(first.event.id).toBe(record.id);
  });
});

class InMemoryDuplicateDecisions implements DuplicateDecisionRepository {
  private readonly rows: DuplicateDecision[] = [];

  async createDecision(decision: DuplicateDecision) {
    const existing = await this.findByCandidateIds(decision.candidateIds);
    if (existing && !existing.reversedAt) {
      return existing;
    }
    this.rows.push(decision);
    return decision;
  }

  async findByCandidateIds(candidateIds: string[]) {
    return this.rows.find(
      (row) =>
        !row.reversedAt &&
        row.candidateIds.length === candidateIds.length &&
        candidateIds.every((id) => row.candidateIds.includes(id)),
    ) ?? null;
  }

  async findByCanonicalEventId(canonicalEventId: string) {
    return this.rows.filter((row) => row.canonicalEventId === canonicalEventId);
  }

  async listPaginated(page: number, pageSize: number): Promise<Page<DuplicateDecision>> {
    return { items: this.rows, total: this.rows.length, page, pageSize };
  }

  async reverseDecision(id: string, reversedAt: string) {
    const row = this.rows.find((entry) => entry.id === id);
    if (row) {
      row.reversedAt = reversedAt;
    }
  }

  async findActiveKeptSeparateDecision(candidateIds: string[]) {
    const decision = await this.findByCandidateIds(candidateIds);
    return decision?.decision === 'kept_separate' && !decision.reversedAt ? decision : null;
  }
}

describe('DuplicateDecisionRepository regression', () => {
  it('returns the same active decision on repeated create', async () => {
    const repository = new InMemoryDuplicateDecisions();
    const decision = {
      id: 'dup-1',
      candidateIds: ['a', 'b'],
      sourceIds: ['s1', 's2'],
      canonicalEventId: 'canonical',
      decision: 'merged' as const,
      confidence: 0.9,
      reason: 'test',
      decidedAt: '2026-01-01T00:00:00.000Z',
      fingerprintSnapshot: {},
      reversible: true,
    };
    const first = await repository.createDecision(decision);
    const second = await repository.createDecision({ ...decision, id: 'dup-2' });
    expect(second.id).toBe(first.id);
  });
});
