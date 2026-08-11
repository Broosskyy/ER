import { describe, expect, it } from 'vitest';

import {
  applyDuplicateUrlReconciliationToDraft,
  isEventIdentityUrl,
  reconciledClusterToConnectorOutputs,
  reconcileDuplicateUrlClusters,
  type ReconciledDraftInput,
} from '../duplicate-url-reconciliation';
import type { ConnectorOutput } from '../event-evidence';
import type { ResolvedEventCluster } from '../cross-source-event-resolver';
import { SourceAdapter } from '../source-adapter';
import { UnifiedImportDraftService } from '../unified-import-draft-service';
import {
  deriveImportDraftIdempotencyKey,
  partitionFaultIsolatedDrafts,
  tryDeriveImportDraftIdempotencyKey,
} from '../import-draft-record-mapper';

const VERIFIED_AT = '2026-08-11T20:00:00.000Z';
const SHARED_URL = 'https://events.example/nights/alpha';

function output(
  sourceId: string,
  overrides: Partial<ConnectorOutput> = {},
): ConnectorOutput {
  return {
    sourceId,
    sourceFamily: 'official_website',
    sourceUrl: SHARED_URL,
    verifiedAt: VERIFIED_AT,
    title: 'Alpha Night',
    startDate: '2026-09-05T22:00:00+02:00',
    venueName: 'Main Hall',
    officialWebsiteUrl: SHARED_URL,
    genres: ['Tech House'],
    diagnostics: [],
    ...overrides,
  };
}

function cluster(
  id: string,
  outputs: ConnectorOutput[],
): ResolvedEventCluster {
  const contributions = outputs.map((entry, index) => ({
    contributionId: `${id}:contribution:${index}`,
    externalId: `${id}:external:${index}`,
    evidence: new SourceAdapter().adapt(entry),
  }));
  return {
    clusterId: id,
    contributionIds: contributions.map((entry) => entry.contributionId),
    contributions,
    diagnostics: [],
  };
}

function draftFrom(input: ReconciledDraftInput) {
  const outputs = reconciledClusterToConnectorOutputs(input);
  const draft = new UnifiedImportDraftService().process({
    id: `submission:${input.clusterId}`,
    kind: 'automatic_source',
    submitter: { role: 'system', trustHint: 'official_source' },
    submittedAt: VERIFIED_AT,
    sourceId: outputs[0]!.sourceId,
    externalId: 'stable-native-id',
    connectorOutputs: outputs,
  }).draft;
  return applyDuplicateUrlReconciliationToDraft(draft, input);
}

describe('duplicate concrete URL reconciliation', () => {
  it('combines compatible identity into one draft input', () => {
    const result = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('official-a')]),
      cluster('cluster-b', [
        output('ticket-b', {
          sourceFamily: 'ticket_io',
          officialWebsiteUrl: undefined,
          publicTicketUrl: SHARED_URL,
        }),
      ]),
    ]);

    expect(result.draftInputs).toHaveLength(1);
    expect(result.draftInputs[0]).toMatchObject({
      reconciliationMode: 'compatible_merge',
      originalClusterIds: ['cluster-a', 'cluster-b'],
    });
    expect(result.draftInputs[0]?.contributions).toHaveLength(2);
    expect(result.compatibleMergedGroups).toBe(1);
  });

  it('combines the same URL from different sources', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [output('source-b')]),
    ]).draftInputs;

    expect(input?.identitySnapshots.flatMap((entry) => entry.sourceIds).sort()).toEqual([
      'source-a',
      'source-b',
    ]);
    expect(draftFrom(input!).sources).toHaveLength(2);
  });

  it('creates one conflict draft for a different calendar day', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [
        output('source-b', { startDate: '2026-09-06T22:00:00+02:00' }),
      ]),
    ]).draftInputs;
    const draft = draftFrom(input!);

    expect(input?.conflictReasons).toContain('same_public_url_date_conflict');
    expect(draft.reviewTrack).toBe('conflict_review');
    expect(draft.proposedCanonicalEvent).toBeUndefined();
    expect(draft.audit.duplicateUrlReconciliation?.identitySnapshots).toHaveLength(2);
  });

  it('creates one conflict draft for an incompatible venue', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [output('source-b', { venueName: 'River Arena' })]),
    ]).draftInputs;

    expect(input?.reconciliationMode).toBe('identity_conflict');
    expect(input?.conflictReasons).toContain('same_public_url_venue_conflict');
    expect(draftFrom(input!).recommendedDuplicateAction).toBe(
      'review_duplicate_url_identity',
    );
  });

  it('creates one conflict draft for a different structured title core', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [output('source-b', { title: 'Beta Session' })]),
    ]).draftInputs;

    expect(input?.reconciliationMode).toBe('identity_conflict');
    expect(input?.conflictReasons).toContain('same_public_url_title_conflict');
    expect(draftFrom(input!).reviewReasons).toContain(
      'same_public_url_title_conflict',
    );
  });

  it('does not let one URL conflict block another safe draft', () => {
    const result = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [
        output('source-b', { startDate: '2026-09-06T22:00:00+02:00' }),
      ]),
      cluster('cluster-safe', [
        output('source-safe', {
          sourceUrl: 'https://events.example/nights/safe',
          officialWebsiteUrl: 'https://events.example/nights/safe',
          title: 'Safe Night',
        }),
      ]),
    ]);

    expect(result.draftInputs).toHaveLength(2);
    expect(
      result.draftInputs.map((entry) => entry.reconciliationMode).sort(),
    ).toEqual(['identity_conflict', 'none']);
  });

  it('preserves official and ticket URL roles', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-official', [output('official')]),
      cluster('cluster-ticket', [
        output('ticket', {
          sourceFamily: 'ticket_io',
          officialWebsiteUrl: undefined,
          publicTicketUrl: SHARED_URL,
          admissionPrice: { amount: 20, currency: 'EUR' },
        }),
      ]),
    ]).draftInputs;
    const outputs = reconciledClusterToConnectorOutputs(input!);

    expect(outputs.find((entry) => entry.sourceId === 'official')).toMatchObject({
      officialWebsiteUrl: SHARED_URL,
      publicTicketUrl: undefined,
    });
    expect(outputs.find((entry) => entry.sourceId === 'ticket')).toMatchObject({
      officialWebsiteUrl: undefined,
      publicTicketUrl: SHARED_URL,
    });
  });

  it('does not treat an outbound-only shared URL as event identity', () => {
    const sharedOutbound = 'https://downloads.example/apps/tickets';
    const result = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [
        output('source-a', {
          sourceUrl: 'https://events.example/nights/one',
          officialWebsiteUrl: 'https://events.example/nights/one',
          outboundTicketUrls: [sharedOutbound],
        }),
      ]),
      cluster('cluster-b', [
        output('source-b', {
          sourceUrl: 'https://events.example/nights/two',
          officialWebsiteUrl: 'https://events.example/nights/two',
          outboundTicketUrls: [sharedOutbound],
          title: 'Second Night',
          startDate: '2026-09-06T22:00:00+02:00',
        }),
      ]),
    ]);

    expect(result.duplicateUrlGroups).toHaveLength(0);
    expect(result.draftInputs).toHaveLength(2);
  });

  it('does not treat an app download URL as event identity or a secure draft key', () => {
    const appDownloadUrl = 'https://download.example/apps/ticket-client';
    const result = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [
        output('source-a', {
          sourceUrl: appDownloadUrl,
          officialWebsiteUrl: appDownloadUrl,
        }),
      ]),
      cluster('cluster-b', [
        output('source-b', {
          sourceUrl: appDownloadUrl,
          officialWebsiteUrl: appDownloadUrl,
          title: 'Unrelated Night',
          startDate: '2026-09-06T22:00:00+02:00',
        }),
      ]),
    ]);
    const unsafe = {
      ...draftFrom(result.draftInputs[0]!),
      sourceExternalId: appDownloadUrl,
      proposedCanonicalEvent: undefined,
    };

    expect(isEventIdentityUrl(appDownloadUrl)).toBe(false);
    expect(result.duplicateUrlGroups).toHaveLength(0);
    expect(result.draftInputs).toHaveLength(2);
    expect(tryDeriveImportDraftIdempotencyKey(unsafe, 'source-a')).toBeUndefined();
  });

  it('quarantines one invalid draft without blocking an independent valid draft', () => {
    const [validInput] = reconcileDuplicateUrlClusters([
      cluster('cluster-valid', [
        output('source-valid', {
          sourceUrl: 'https://events.example/nights/valid',
          officialWebsiteUrl: 'https://events.example/nights/valid',
        }),
      ]),
    ]).draftInputs;
    const validDraft = draftFrom(validInput!);
    const invalidDraft = {
      ...validDraft,
      id: 'invalid-draft',
      sourceExternalId: undefined,
      proposedCanonicalEvent: undefined,
      evidence: [],
      sources: [],
    };
    const result = partitionFaultIsolatedDrafts(
      [
        {
          clusterId: 'cluster-invalid',
          sourceId: 'source-invalid',
          draft: invalidDraft,
        },
        {
          clusterId: 'cluster-valid',
          sourceId: 'source-valid',
          draft: validDraft,
        },
      ],
      (draft) => (draft.evidence.length ? [] : ['missing_evidence']),
    );

    expect(result.valid.map((entry) => entry.clusterId)).toEqual(['cluster-valid']);
    expect(result.quarantined).toHaveLength(1);
    expect(result.quarantined[0]?.reasons).toEqual([
      'missing_evidence',
      'no_secure_idempotency_key',
    ]);
  });

  it('keeps normalized genres multi-select and deduplicated', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a', { genres: ['Tech House', 'Techno'] })]),
      cluster('cluster-b', [output('source-b', { genres: ['Tech-House'] })]),
    ]).draftInputs;
    const draft = draftFrom(input!);

    expect(draft.genres.rawValues).toEqual(['Tech House', 'Techno', 'Tech-House']);
    expect(draft.genres.normalizedLabels).toEqual(['Tech House', 'Techno']);
  });

  it('derives the same draft key on a repeated reconciliation', () => {
    const clusters = [
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [output('source-b')]),
    ];
    const first = draftFrom(reconcileDuplicateUrlClusters(clusters).draftInputs[0]!);
    const second = draftFrom(reconcileDuplicateUrlClusters(clusters).draftInputs[0]!);

    expect(deriveImportDraftIdempotencyKey(first, 'source-a')).toBe(
      deriveImportDraftIdempotencyKey(second, 'source-a'),
    );
    expect(second.reviewTrack).not.toBe('conflict_review');
  });
});
