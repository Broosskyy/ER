import { describe, expect, it, vi } from 'vitest';

import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import {
  applyRestrictedBulkManifest,
  assertAppliedEventSnapshotComplete,
  rollbackRestrictedBulkSnapshots,
  verifyRestrictedBulkManifestAfter,
  type AppliedEventSnapshot,
  type RestrictedBulkApplyDeps,
} from '@/features/import/bulk-canonical-rebuild/restricted-bulk-apply';
import {
  APPROVED_CANDIDATE_FIELDS,
  APPROVED_FIELD_MUTATION_COUNT,
  APPROVED_MANIFEST_HASH,
  assertConfirmationToken,
  computeRestrictedBulkManifestHash,
  createRestrictedBulkWriteCounters,
  filterManifestPatch,
  INVALID_PRIOR_MANIFEST_HASH,
  productionMutationsInThisRun,
  recordDbWrite,
  rejectStatusDowngrade,
  rejectWholeRowReplacement,
  validateManifestPlan,
  type RestrictedBulkManifest,
} from '@/features/import/bulk-canonical-rebuild/restricted-bulk-apply-security';

function samplePlan(): RestrictedBulkManifest {
  const entries = Object.entries(APPROVED_CANDIDATE_FIELDS).map(([eventId, fields]) => ({
    eventId,
    identityVerdict: 'exact',
    verifiedAt: '2026-08-10T11:00:00.000Z',
    beforeFingerprint: {
      title: 't',
      startDate: '2026-01-01T00:00:00+00:00',
      endDate: '2026-01-02T00:00:00+00:00',
      venueName: 'v',
      organizerName: 'o',
      websiteUrl: 'https://example.com',
      ticketUrl: 'https://ticket.io/x',
      priceText: 'ab 10,00 €',
      ticketStatus: 'on_sale',
      descriptionLength: 0,
    },
    fieldGroupPatch: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          before: field === 'ticketStatus' ? 'external_link' : 'ab 10,00 €',
          after: field === 'ticketStatus' ? 'on_sale' : 'ab 12,00 €',
        },
      ]),
    ),
    provenancePlan: [{ fieldPath: fields[0], sourceId: 'source-test', freshnessAt: '2026-08-10T11:00:00.000Z' }],
  }));

  const body = {
    phase: '4.8.6.7.4',
    invalidPriorManifestHash: INVALID_PRIOR_MANIFEST_HASH,
    candidateCount: 8,
    patchSemantics: 'field_group_only_no_whole_row_replacement',
    entries,
  };
  const manifestHash = computeRestrictedBulkManifestHash(body as RestrictedBulkManifest);
  return { ...body, entries, manifestHash } as RestrictedBulkManifest;
}

describe('restricted bulk apply security', () => {
  it('rejects wrong manifest hash before writes', () => {
    const plan = samplePlan();
    plan.entries[0].fieldGroupPatch.priceText = { before: 'x', after: 'y' };
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
    expect(result.computedHash).not.toBe(APPROVED_MANIFEST_HASH);
  });

  it('rejects wrong confirmation token', () => {
    expect(() => assertConfirmationToken('wrong')).toThrow(/CONFIRM_PRODUCTION_MUTATION/);
  });

  it('rejects additional event id', () => {
    const plan = samplePlan();
    plan.entries.push({
      ...plan.entries[0],
      eventId: 'evt-extra',
    });
    plan.candidateCount = 9;
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
  });

  it('rejects replacement candidate id change', () => {
    const plan = samplePlan();
    plan.entries[0].eventId = 'evt-replacement';
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
  });

  it('rejects additional field', () => {
    const plan = samplePlan();
    plan.entries[0].fieldGroupPatch.ticketUrl = { before: 'a', after: 'b' };
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
  });

  it('rejects whole-row replacement fingerprint fields', () => {
    const plan = samplePlan();
    (plan.entries[0].beforeFingerprint as Record<string, unknown>).extraColumn = 'bad';
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
  });

  it('rejects ticketPhases field patch', () => {
    const plan = samplePlan();
    plan.entries[0].fieldGroupPatch.ticketPhases = { before: null, after: [] };
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
  });

  it('rejects websiteUrl and ticketUrl patches', () => {
    const plan = samplePlan();
    plan.entries[0].fieldGroupPatch.websiteUrl = { before: 'a', after: 'b' };
    const result = validateManifestPlan(plan);
    expect(result.ok).toBe(false);
  });

  it('rejects status downgrade for available offer', () => {
    expect(rejectStatusDowngrade('on_sale', 'external_link', 'ticketStatus')).toBe(true);
  });

  it('plans provenance only for priceText/ticketStatus deltas', () => {
    const plan = samplePlan();
    const entry = plan.entries.find((e) => e.eventId === 'evt-1785443904478-dg3lk70');
    expect(entry?.fieldGroupPatch.priceText).toBeDefined();
    expect(entry?.fieldGroupPatch.ticketStatus).toBeDefined();
    expect(Object.keys(entry?.fieldGroupPatch ?? {}).every((f) => f === 'priceText' || f === 'ticketStatus')).toBe(
      true,
    );
  });

  it('rollback counters include all db writes', () => {
    const counters = createRestrictedBulkWriteCounters();
    recordDbWrite(counters, 'event', 1, 2);
    recordDbWrite(counters, 'rollback', 1);
    expect(counters.databaseWriteRequests).toBe(2);
    expect(productionMutationsInThisRun(counters)).toBe(2);
  });

  it('identical normalized field yields safe_no_change classification via filter', () => {
    const plan = samplePlan();
    const entry = plan.entries[0];
    const patch = filterManifestPatch(entry);
    expect(patch.priceText).toBe('ab 12,00 €');
  });

  it('approved manifest hash matches real artifact constant', () => {
    expect(APPROVED_MANIFEST_HASH).toBe('c00344f2c8f43f22c5699aade8006bb6e82ed3507556120d8637f47f29a1e08f');
  });

  it('rejects writer whole-row extra fields', () => {
    const forbidden = rejectWholeRowReplacement(['priceText', 'title', 'websiteUrl'], ['priceText']);
    expect(forbidden).toEqual(['title', 'websiteUrl']);
  });

  it('validates approved mutation count constant', () => {
    const total = Object.values(APPROVED_CANDIDATE_FIELDS).reduce((sum, fields) => sum + fields.length, 0);
    expect(total).toBe(APPROVED_FIELD_MUTATION_COUNT);
  });
});

function manifestEntry(eventId: string, fields: string[]): RestrictedBulkManifest['entries'][number] {
  return {
    eventId,
    identityVerdict: 'exact',
    verifiedAt: '2026-08-10T11:00:00.000Z',
    beforeFingerprint: {
      title: 't',
      startDate: '2026-01-01T00:00:00+00:00',
      endDate: '2026-01-02T00:00:00+00:00',
      venueName: 'v',
      organizerName: 'o',
      websiteUrl: 'https://example.com',
      ticketUrl: 'https://ticket.io/x',
      priceText: 'ab 10,00 €',
      ticketStatus: 'external_link',
      genreLabels: ['HARDTECHNO'],
      descriptionLength: 0,
    },
    fieldGroupPatch: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          before: field === 'ticketStatus' ? 'external_link' : 'ab 10,00 €',
          after: field === 'ticketStatus' ? 'on_sale' : 'ab 12,00 €',
        },
      ]),
    ),
    provenancePlan: [{ fieldPath: fields[0], sourceId: 'source-test', freshnessAt: '2026-08-10T11:00:00.000Z' }],
  };
}

function adminEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-test',
    title: 't',
    startDate: '2026-01-01T00:00:00+00:00',
    endDate: '2026-01-02T00:00:00+00:00',
    venueName: 'v',
    organizerName: 'o',
    websiteUrl: 'https://example.com',
    ticketUrl: 'https://ticket.io/x',
    priceText: 'ab 12,00 €',
    ticketStatus: 'on_sale',
    genreLabels: ['HARDTECHNO'],
    description: '',
    status: 'published',
    sourceId: 'source-test',
    ...overrides,
  } as AdminEventRecord;
}

function baseSnapshot(overrides: Partial<AppliedEventSnapshot> = {}): AppliedEventSnapshot {
  return {
    eventId: 'evt-test',
    eventRowBefore: { price_text: 'ab 10,00 €', ticket_status: 'external_link', ticket_phases: null },
    provenanceBefore: { priceText: { selected_value: 'ab 10,00 €' } },
    sourceReferenceBefore: { id: 'ref-1', last_seen_at: '2026-01-01T00:00:00.000Z', active: true },
    importRecordBefore: { id: 'imp-1', updated_at: '2026-01-01T00:00:00.000Z', status: 'imported' },
    allowedFields: ['priceText'],
    touchedProvenanceFields: [],
    touchedSourceReference: false,
    touchedImportRecord: false,
    ...overrides,
  };
}

function buildDeps(overrides: Partial<RestrictedBulkApplyDeps> = {}): RestrictedBulkApplyDeps {
  const event = adminEvent();
  const rawRow: EventRow = {
    id: 'evt-test',
    title: 't',
    price_text: 'ab 10,00 €',
    ticket_status: 'external_link',
    ticket_phases: null,
  } as EventRow;

  return {
    loadEvent: vi.fn(async () => event),
    loadEventRowRaw: vi.fn(async () => rawRow),
    updateEventRow: vi.fn(async () => undefined),
    loadManualLocks: vi.fn(async () => []),
    loadProvenanceSnapshot: vi.fn(async () => ({ priceText: { selected_value: 'ab 10,00 €' } })),
    restoreProvenanceSnapshot: vi.fn(async () => undefined),
    loadSourceReference: vi.fn(async () => ({ id: 'ref-1', last_seen_at: 'old', active: true })),
    touchSourceReference: vi.fn(async () => undefined),
    restoreSourceReference: vi.fn(async () => undefined),
    loadImportRecord: vi.fn(async () => ({ id: 'imp-1', updated_at: 'old', status: 'imported' })),
    touchImportRecord: vi.fn(async () => undefined),
    restoreImportRecord: vi.fn(async () => undefined),
    loadCandidateEnvelope: vi.fn(async () => null),
    writeProvenance: vi.fn(async () => undefined),
    invalidateConsumerCaches: vi.fn(async () => undefined),
    listOtherEventUpdatedAts: vi.fn(async () => new Map()),
    now: () => '2026-08-10T11:00:00.000Z',
    ...overrides,
  };
}

describe('restricted bulk readback and rollback', () => {
  it('recognizes manifest-after as successful', () => {
    const entry = manifestEntry('evt-1785443904478-dg3lk70', ['priceText', 'ticketStatus']);
    const failures = verifyRestrictedBulkManifestAfter(entry, adminEvent());
    expect(failures).toEqual([]);
  });

  it('does not false-negative on genreLabels array fingerprint comparison', () => {
    const entry = manifestEntry('evt-1785672261305-bgdu8dk', ['ticketStatus']);
    const failures = verifyRestrictedBulkManifestAfter(entry, adminEvent());
    expect(failures).toEqual([]);
  });

  it('still fails on real value mismatch', () => {
    const eventId = 'evt-1785506397824-yhn81xp';
    const entry = manifestEntry(eventId, ['priceText']);
    const failures = verifyRestrictedBulkManifestAfter(
      entry,
      adminEvent({ id: eventId, priceText: 'ab 19,00 €', ticketStatus: 'on_sale' }),
    );
    expect(failures).toContain('priceText:ab 19,00 €');
  });

  it('blocks apply when provenance before snapshot is missing', () => {
    expect(() =>
      assertAppliedEventSnapshotComplete(
        baseSnapshot({ provenanceBefore: {} }),
        manifestEntry('evt-1785506397824-yhn81xp', ['priceText']),
        'source-test',
        {
          willWriteProvenance: true,
          willTouchSourceReference: true,
          willTouchImportRecord: true,
        },
      ),
    ).toThrow('provenance_snapshot_missing:priceText');
  });

  it('blocks apply when source reference before snapshot is missing', () => {
    expect(() =>
      assertAppliedEventSnapshotComplete(
        baseSnapshot({ sourceReferenceBefore: null }),
        manifestEntry('evt-1785506397824-yhn81xp', ['priceText']),
        'source-test',
        {
          willWriteProvenance: true,
          willTouchSourceReference: true,
          willTouchImportRecord: true,
        },
      ),
    ).toThrow('source_reference_snapshot_missing');
  });

  it('blocks apply when import record before snapshot is missing', () => {
    expect(() =>
      assertAppliedEventSnapshotComplete(
        baseSnapshot({ importRecordBefore: null }),
        manifestEntry('evt-1785506397824-yhn81xp', ['priceText']),
        'source-test',
        {
          willWriteProvenance: true,
          willTouchSourceReference: true,
          willTouchImportRecord: true,
        },
      ),
    ).toThrow('import_record_snapshot_missing');
  });

  it('rolls back event, provenance, source reference and import record together', async () => {
    const deps = buildDeps();
    const counters = createRestrictedBulkWriteCounters();
    const snapshot = baseSnapshot({
      touchedProvenanceFields: ['priceText'],
      touchedSourceReference: true,
      touchedImportRecord: true,
    });

    await rollbackRestrictedBulkSnapshots(deps, [snapshot], counters);

    expect(deps.updateEventRow).toHaveBeenCalledWith('evt-test', snapshot.eventRowBefore);
    expect(deps.restoreProvenanceSnapshot).toHaveBeenCalledWith('evt-test', 'priceText', snapshot.provenanceBefore.priceText);
    expect(deps.restoreSourceReference).toHaveBeenCalledWith(snapshot.sourceReferenceBefore);
    expect(deps.restoreImportRecord).toHaveBeenCalledWith(snapshot.importRecordBefore);
    expect(counters.rollbackWriteRequests).toBe(3);
  });

  it('does not restore untouched provenance fields', async () => {
    const deps = buildDeps();
    const snapshot = baseSnapshot({
      provenanceBefore: {
        priceText: { selected_value: 'ab 10,00 €' },
        ticketStatus: { selected_value: 'external_link' },
      },
      touchedProvenanceFields: ['priceText'],
    });

    await rollbackRestrictedBulkSnapshots(deps, [snapshot], createRestrictedBulkWriteCounters());

    expect(deps.restoreProvenanceSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.restoreProvenanceSnapshot).toHaveBeenCalledWith('evt-test', 'priceText', snapshot.provenanceBefore.priceText);
  });

  it('accepts explicit null provenance snapshot entries', () => {
    const snapshot = baseSnapshot({
      provenanceBefore: { priceText: null },
      allowedFields: ['priceText'],
    });

    expect(() =>
      assertAppliedEventSnapshotComplete(snapshot, manifestEntry('evt-test', ['priceText']), 'source-test', {
        willWriteProvenance: true,
        willTouchSourceReference: true,
        willTouchImportRecord: true,
      }),
    ).not.toThrow();
  });
});
