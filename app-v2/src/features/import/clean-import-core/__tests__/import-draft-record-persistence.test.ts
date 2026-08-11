import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ImportAdminRepository } from '@/data/repositories/import-admin-repository';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import {
  buildImportRecordFromInput,
  upsertImportRecordsBySourceExternal,
} from '@/data/datasources/import-record-upsert';
import type {
  CreateImportRecordInput,
  ImportRecord,
} from '@/features/import/models/types';

import { buildCompactDraftReviewCard } from '../admin-draft-review';
import {
  ImportRecordDraftReviewPersistence,
  selectAllSafeDraftIds,
} from '../draft-review-persistence';
import type { ConnectorOutput } from '../event-evidence';
import {
  mapImportDraftToRecordInput,
  mapImportRecordToDraft,
  readImportDraftEnvelope,
} from '../import-draft-record-mapper';
import { ImportRecordDraftPersistence } from '../import-draft-record-persistence';
import type { ImportDraft } from '../import-draft';
import type { ImportSubmission } from '../import-submission';
import { UnifiedImportDraftService } from '../unified-import-draft-service';
import { REFERENCE_FIXTURES } from './fixtures/reference-fixtures';
import { ImportRunner } from '../import-runner';

const VERIFIED_AT = '2026-08-10T18:00:00.000Z';
const CONTEXT = { importJobId: 'job-1', sourceId: 'source-1' };

function completeOutput(
  overrides: Partial<ConnectorOutput> = {},
): ConnectorOutput {
  return {
    sourceId: 'source-1',
    sourceFamily: 'official_website',
    sourceUrl: 'https://official.example/events/stable-night',
    verifiedAt: VERIFIED_AT,
    title: 'Stable Night',
    startDate: '2026-11-01T22:00:00+02:00',
    endDate: '2026-11-02T06:00:00+02:00',
    venueName: 'Reference Club',
    officialWebsiteUrl: 'https://official.example/events/stable-night',
    description: 'Original description',
    genres: ['Techno', 'Tech-House'],
    lineup: [
      {
        sortOrder: 0,
        displayName: 'Nova Pulse',
        rawSourceSpelling: 'Nova Pulse',
        normalizedName: 'nova pulse',
        billingRelation: 'SOLO',
        isB2b: false,
        isF2f: false,
        isLiveSet: false,
        confidence: 0.95,
        reviewState: 'accepted',
        inclusionReason: 'test',
      },
    ],
    lineupState: 'explicit_artists',
    minimumAge: '18',
    venueEnvironment: 'indoor',
    ...overrides,
  };
}

function automaticSubmission(
  output: ConnectorOutput,
  overrides: Partial<ImportSubmission> = {},
): ImportSubmission {
  return {
    id: 'submission-1',
    kind: 'automatic_source',
    submitter: { role: 'system', trustHint: 'official_source' },
    submittedAt: VERIFIED_AT,
    externalId: 'source-native-stable-night',
    connectorOutputs: [output],
    ...overrides,
  };
}

class MemoryRecordRepository implements ImportRecordRepository {
  records: ImportRecord[] = [];
  createCount = 0;
  updateCount = 0;

  async create(input: CreateImportRecordInput): Promise<ImportRecord> {
    this.createCount += 1;
    const record = buildImportRecordFromInput(input, {
      id: `record-${this.createCount}`,
      now: `2026-08-10T18:00:0${this.createCount}.000Z`,
    });
    this.records.push(record);
    return record;
  }

  async createMany(inputs: CreateImportRecordInput[]): Promise<ImportRecord[]> {
    return Promise.all(inputs.map((input) => this.create(input)));
  }

  async upsertManyBySourceExternal(
    inputs: CreateImportRecordInput[],
  ): Promise<ImportRecord[]> {
    return upsertImportRecordsBySourceExternal(inputs, {
      findLatest: (sourceId, externalId) =>
        this.findLatestBySourceAndExternalId(sourceId, externalId),
      create: (input) => this.create(input),
      update: (record) => this.update(record),
    });
  }

  async update(record: ImportRecord): Promise<ImportRecord> {
    this.updateCount += 1;
    const updated = {
      ...record,
      updatedAt: `2026-08-10T19:00:0${this.updateCount}.000Z`,
    };
    this.records = this.records.map((entry) =>
      entry.id === record.id ? updated : entry,
    );
    return updated;
  }

  async getById(id: string): Promise<ImportRecord | null> {
    return this.records.find((record) => record.id === id) ?? null;
  }

  async findLatestBySourceAndExternalId(
    sourceId: string,
    externalId: string,
  ): Promise<ImportRecord | null> {
    return (
      this.records
        .filter(
          (record) =>
            record.sourceId === sourceId &&
            record.externalId === externalId,
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ??
      null
    );
  }

  async listLatestBySourceId(sourceId: string): Promise<ImportRecord[]> {
    return this.records.filter((record) => record.sourceId === sourceId);
  }

  async listByJobId(importJobId: string): Promise<ImportRecord[]> {
    return this.records.filter(
      (record) => record.importJobId === importJobId,
    );
  }
}

function memoryAdminRepository(
  records: MemoryRecordRepository,
): ImportAdminRepository {
  return {
    async updateIfUnchanged(record, expectedUpdatedAt) {
      const current = await records.getById(record.id);
      if (!current || current.updatedAt !== expectedUpdatedAt) {
        throw new Error('concurrent_update');
      }
      return records.update(record);
    },
  } as ImportAdminRepository;
}

function asDatabaseRecord(
  input: CreateImportRecordInput,
  id = 'record-roundtrip',
): ImportRecord {
  const record = buildImportRecordFromInput(input, {
    id,
    now: VERIFIED_AT,
  });
  return {
    ...record,
    rawPayload: JSON.parse(JSON.stringify(record.rawPayload)) as Record<
      string,
      unknown
    >,
    normalizedPayload: JSON.parse(
      JSON.stringify(record.normalizedPayload),
    ) as Record<string, unknown>,
  };
}

describe('ImportDraft ↔ existing import_records persistence', () => {
  it('maps and reads the complete draft envelope without technical field loss', () => {
    const draft = new UnifiedImportDraftService().process(
      automaticSubmission(completeOutput()),
    ).draft;
    const input = mapImportDraftToRecordInput(draft, CONTEXT);
    const stored = asDatabaseRecord(input);
    const read = mapImportRecordToDraft(stored);
    const envelope = readImportDraftEnvelope(stored);

    expect(read).not.toBeNull();
    expect(read?.submissionKind).toBe(draft.submissionKind);
    expect(read?.submitter).toEqual(draft.submitter);
    expect(read?.proposedCanonicalEvent).toEqual(
      draft.proposedCanonicalEvent,
    );
    expect(read?.reviewTrack).toBe(draft.reviewTrack);
    expect(read?.reviewReasons).toEqual(draft.reviewReasons);
    expect(read?.fieldGroupConfidence).toEqual(
      draft.fieldGroupConfidence,
    );
    expect(read?.evidence).toEqual(draft.evidence);
    expect(read?.duplicates).toEqual(draft.duplicates);
    expect(read?.proposedFieldChanges).toEqual(
      draft.proposedFieldChanges,
    );
    expect(read?.missingFields).toEqual(draft.missingFields);
    expect(read?.genres).toEqual(draft.genres);
    expect(read?.proposedCanonicalEvent?.lineup).toEqual(
      draft.proposedCanonicalEvent?.lineup,
    );
    expect(envelope?.urlRoles.websiteUrl).toBe(
      draft.proposedCanonicalEvent?.websiteUrl,
    );
    expect(envelope?.reviewState.decision).toBe('pending');
  });

  it('stores and reads all three review tracks', () => {
    const base = new UnifiedImportDraftService().process(
      automaticSubmission(completeOutput()),
    ).draft;

    for (const track of [
      'auto_ready',
      'quick_review',
      'conflict_review',
    ] as const) {
      const input = mapImportDraftToRecordInput(
        { ...base, reviewTrack: track },
        CONTEXT,
      );
      expect(mapImportRecordToDraft(asDatabaseRecord(input))?.reviewTrack).toBe(
        track,
      );
    }
  });

  it('upserts the same public identity and updates changed evidence', async () => {
    const records = new MemoryRecordRepository();
    const persistence = new ImportRecordDraftPersistence(
      records,
      'import_records_only',
    );
    const service = new UnifiedImportDraftService(
      undefined,
      undefined,
      persistence,
    );

    const first = await service.processAndPersist(
      automaticSubmission(completeOutput()),
      CONTEXT,
    );
    const second = await service.processAndPersist(
      automaticSubmission(
        completeOutput({ description: 'Updated evidence description' }),
        { id: 'submission-2' },
      ),
      { ...CONTEXT, importJobId: 'job-2' },
    );

    expect(records.records).toHaveLength(1);
    expect(second.draft.persistenceRecordId).toBe(
      first.draft.persistenceRecordId,
    );
    expect(second.draft.proposedCanonicalEvent?.description).toBe(
      'Updated evidence description',
    );
    expect(records.createCount).toBe(1);
    expect(records.updateCount).toBe(1);
  });

  it('does not merge another date or incompatible venue', async () => {
    const records = new MemoryRecordRepository();
    const persistence = new ImportRecordDraftPersistence(
      records,
      'import_records_only',
    );
    const service = new UnifiedImportDraftService(
      undefined,
      undefined,
      persistence,
    );

    await service.processAndPersist(
      automaticSubmission(completeOutput()),
      CONTEXT,
    );
    await service.processAndPersist(
      automaticSubmission(
        completeOutput({
          startDate: '2026-11-02T22:00:00+02:00',
          venueName: 'Other Venue',
        }),
        { id: 'submission-other-occurrence' },
      ),
      { ...CONTEXT, importJobId: 'job-2' },
    );

    expect(records.records).toHaveLength(2);
    expect(new Set(records.records.map((record) => record.externalId)).size).toBe(
      2,
    );
  });

  it('keeps the adapter read-only unless import-record writes are explicit', async () => {
    const records = new MemoryRecordRepository();
    const persistence = new ImportRecordDraftPersistence(records, 'read_only');
    const draft = new UnifiedImportDraftService().process(
      automaticSubmission(completeOutput()),
    ).draft;

    const result = await persistence.persist(draft, CONTEXT);
    expect(result.databaseWriteOperations).toBe(0);
    expect(result.productionMutations).toBe(0);
    expect(result.wroteEventsTable).toBe(false);
    expect(records.records).toHaveLength(0);
  });
});

describe('persistent admin exception actions', () => {
  async function persistedDraft(input?: {
    submission?: ImportSubmission;
  }): Promise<{
    draft: ImportDraft;
    records: MemoryRecordRepository;
    review: ImportRecordDraftReviewPersistence;
  }> {
    const records = new MemoryRecordRepository();
    const draftPersistence = new ImportRecordDraftPersistence(
      records,
      'import_records_only',
    );
    const submission =
      input?.submission ?? automaticSubmission(completeOutput());
    const draft = new UnifiedImportDraftService().process(submission).draft;
    const persisted = await draftPersistence.persist(draft, CONTEXT);
    return {
      draft: persisted.draft,
      records,
      review: new ImportRecordDraftReviewPersistence(
        records,
        memoryAdminRepository(records),
        'import_records_only',
      ),
    };
  }

  it('batch selection contains persisted auto_ready drafts only', () => {
    const base = new UnifiedImportDraftService().process(
      automaticSubmission(completeOutput()),
    ).draft;
    const auto = {
      ...base,
      reviewTrack: 'auto_ready' as const,
      persistenceRecordId: 'record-auto',
    };
    const quick = {
      ...base,
      id: 'draft:quick',
      persistenceRecordId: 'record-quick',
      reviewTrack: 'quick_review' as const,
    };
    expect(selectAllSafeDraftIds([auto, quick, base])).toEqual([auto.id]);
  });

  it('approval changes only import-record status and is repeatable', async () => {
    const { draft, records, review } = await persistedDraft();
    const action = {
      type: 'approve' as const,
      draftIds: [draft.id],
      actorId: 'reviewer-1',
    };
    const first = await review.apply(action, [draft]);
    const second = await review.apply(action, [draft]);
    const record = records.records[0]!;

    expect(first.databaseWriteOperations).toBe(1);
    expect(second.databaseWriteOperations).toBe(0);
    expect(record.status).toBe('approved');
    expect(record.resultingEventId).toBeUndefined();
    expect(readImportDraftEnvelope(record)?.reviewState.decision).toBe(
      'approved',
    );
  });

  it('preserves confirmed genres while applying admin multi-select edits', async () => {
    const submission = automaticSubmission(completeOutput(), {
      existingConfirmedGenres: ['Techno'],
    });
    const { draft, records, review } = await persistedDraft({ submission });

    await review.apply(
      {
        type: 'edit',
        draftIds: [draft.id],
        actorId: 'reviewer-1',
        edits: { genres: ['House'] },
      },
      [draft],
    );
    const stored = mapImportRecordToDraft(records.records[0]!);
    expect(stored?.genres.normalizedLabels).toEqual(
      expect.arrayContaining(['Techno', 'House']),
    );
    expect(
      stored?.genres.items.some(
        (item) => item.confirmed && item.normalizedLabel === 'Techno',
      ),
    ).toBe(true);
  });

  it('keeps community correction target and submitter auditable', async () => {
    const submission: ImportSubmission = {
      id: 'community-correction',
      kind: 'community_manual',
      submitter: {
        role: 'community',
        userId: 'community-user',
        trustHint: 'untrusted',
      },
      submittedAt: VERIFIED_AT,
      sourceId: 'source-1',
      payload: {
        title: 'Stable Night',
        startDate: '2026-11-01T22:00:00+02:00',
        venueName: 'Reference Club',
        eventUrl: 'https://official.example/events/stable-night',
        websiteUrl: 'https://official.example/events/stable-night',
        genres: ['Techno'],
        lineupNames: ['Nova Pulse'],
        correctionTargetEventId: 'target-event',
      },
    };
    const { draft, records } = await persistedDraft({ submission });
    const read = mapImportRecordToDraft(records.records[0]!);

    expect(draft.correctionTargetEventId).toBe('target-event');
    expect(read?.submitter.userId).toBe('community-user');
    expect(read?.correctionTargetEventId).toBe('target-event');
    expect(read?.proposedFieldChanges).toContainEqual(
      expect.objectContaining({
        field: 'identity',
        proposedValue: 'supplement_existing',
      }),
    );
  });

  it('keeps diagnosis separate from compact card fields', async () => {
    const { draft } = await persistedDraft();
    const card = buildCompactDraftReviewCard(draft);
    expect(card.title).toBe('Stable Night');
    expect(card.genres).toEqual(['Techno', 'Tech House']);
    expect('evidence' in card).toBe(false);
    expect('fieldGroupConfidence' in card).toBe(false);
    expect(card.diagnose.fieldGroupConfidence.identity).toBeTruthy();
    expect(card.diagnose.urlRoles.websiteUrl).toBeTruthy();
    expect(card.diagnose.verifiedAt).toBe(VERIFIED_AT);
  });

  it('contains no events-table writes in persistence production modules', () => {
    const files = [
      'import-draft-record-mapper.ts',
      'import-draft-record-persistence.ts',
      'draft-review-persistence.ts',
    ];
    for (const file of files) {
      const source = readFileSync(
        join(process.cwd(), 'src/features/import/clean-import-core', file),
        'utf8',
      );
      expect(source).not.toMatch(/\.from\(\s*['"]events['"]\s*\)/);
      expect(source).not.toMatch(
        /from\s+['"][^'"]*event-repositor|publishToEvents/i,
      );
    }
  });

  it('keeps all seven reference fixtures green', () => {
    const runner = new ImportRunner();
    expect(REFERENCE_FIXTURES).toHaveLength(7);
    for (const fixture of REFERENCE_FIXTURES) {
      expect(runner.run(fixture.outputs).decision).toBeTruthy();
    }
  });
});
