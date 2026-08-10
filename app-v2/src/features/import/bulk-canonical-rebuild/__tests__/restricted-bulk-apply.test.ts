import { describe, expect, it } from 'vitest';

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
