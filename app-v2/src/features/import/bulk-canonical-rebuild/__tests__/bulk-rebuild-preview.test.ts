import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { canonicalImportEventToEvidenceBundle } from '@/features/import/generic-truth-pipeline/evidence-from-canonical';

import { runAcceptanceAudit } from '@/features/import/bulk-canonical-rebuild/acceptance-runner';
import { enrichCandidateForBulkEvidence, buildBulkRebuildEvidenceBundle } from '@/features/import/bulk-canonical-rebuild/bulk-evidence-bundle';
import { assessContributionCollisions } from '@/features/import/bulk-canonical-rebuild/contribution-collision';
import { auditConsumerQuality } from '@/features/import/bulk-canonical-rebuild/consumer-quality-audit';
import {
  assessPublishCore,
  classifyDisposition,
  resolveIdPreservation,
} from '@/features/import/bulk-canonical-rebuild/disposition';
import {
  extractRebuiltFieldsFromEvidence,
  mergeRebuiltFieldGroups,
} from '@/features/import/bulk-canonical-rebuild/evidence-field-extractor';
import { buildIdentityClusters } from '@/features/import/bulk-canonical-rebuild/identity-graph';
import { assembleRebuiltCanonicalEvent } from '@/features/import/bulk-canonical-rebuild/rebuild-assembler';
import type { BulkRebuildEventRow, SourceEvidenceContribution } from '@/features/import/bulk-canonical-rebuild/types';

function baseCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    sourceId: 'src-1',
    sourceName: 'Test Source',
    rawSourceType: 'html',
    externalId: 'ext-1',
    title: 'Test Event',
    startDate: '2026-09-05T20:00:00.000Z',
    endDate: '2026-09-06T05:00:00.000Z',
    venueName: 'Bootshaus',
    cityName: 'Cologne',
    ticketUrl: 'https://ticketkings.de/event/test',
    priceText: 'ab 15,00 €',
    sourceMetadata: {
      pageTitle: 'Test Event',
      eventDate: '2026-09-05',
      venueName: 'Bootshaus',
      verifiedAt: '2026-08-01T00:00:00.000Z',
      publicCtaCandidateUrl: 'https://ticketkings.de/event/test',
      unifiedDescription: 'Clean description without cookie text.',
      unifiedGenres: ['Techno'],
      ticketStatus: 'on_sale',
      connector: 'website',
    },
    ...overrides,
  };
}

function contributionFromCandidate(
  candidate: CanonicalImportEvent,
  overrides: Partial<SourceEvidenceContribution> = {},
): SourceEvidenceContribution {
  const enriched = enrichCandidateForBulkEvidence(candidate);
  const bundle = buildBulkRebuildEvidenceBundle(enriched);
  return {
    sourceId: candidate.sourceId,
    sourceName: 'Test Source',
    externalId: candidate.externalId ?? 'ext-1',
    candidate: enriched,
    bundle,
    identityVerdict: 'exact',
    identityReason: 'test',
    verifiedAt: bundle.verifiedAt ?? '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('bulk-canonical-rebuild wiring repair', () => {
  it('native TicketKings evidence is not discarded as legacy fallback', () => {
    const html =
      '<div class="espbp-title-date"><h2>Underland Essigfabrik</h2></div>' +
      '<iframe src="https://nacht-manager.de/ticketing/native_event.php?id=41"></iframe>';
    const candidate = baseCandidate({
      sourceId: 'src-tk',
      ticketUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026',
      eventUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026',
      sourceMetadata: {
        platform: 'ticket_kings',
        connectorKey: 'ticket_platform',
        verifiedAt: '2026-08-01T00:00:00.000Z',
      },
    });
    const bundle = buildBulkRebuildEvidenceBundle(candidate, {
      externalId: 'tk-1',
      status: 'normalized',
      rawPayload: { html },
    });
    expect(bundle.legacyFallbackUsed).toBe(false);
    expect(bundle.sourceNativeEvidence).toBe(true);
  });

  it('missing native evidence stays review-only via publish core', () => {
    const candidate = baseCandidate({ sourceMetadata: {} });
    const bundle = canonicalImportEventToEvidenceBundle(candidate);
    expect(bundle.legacyFallbackUsed).toBe(true);
    const contribution = contributionFromCandidate(candidate, {
      bundle,
      identityVerdict: 'unverifiable',
    });
    const rebuilt = assembleRebuiltCanonicalEvent({
      contributions: [contribution],
      collisionContributionKeys: [],
      eventId: 'evt-test',
    });
    const core = assessPublishCore(rebuilt, [contribution]);
    expect(core.secure).toBe(false);
  });

  it('official website content reaches rebuilt canonical event', () => {
    const official = contributionFromCandidate(
      baseCandidate({
        sourceId: 'src-official',
        description: 'Official body text about the rave.',
        genreNames: ['Techno', 'Hardtechno'],
        sourceMetadata: {
          connector: 'website',
          officialDescription: 'Official body text about the rave.',
          officialGenres: ['Techno', 'Hardtechno'],
          verifiedAt: '2026-08-01T00:00:00.000Z',
          pageTitle: 'Sommerfest',
          eventDate: '2026-08-08',
          venueName: 'Essigfabrik',
        },
      }),
    );
    const rebuilt = assembleRebuiltCanonicalEvent({
      contributions: [official],
      collisionContributionKeys: [],
      eventId: 'evt-official',
    });
    expect(rebuilt.description).toContain('Official body');
    expect(rebuilt.genreLabels?.length).toBeGreaterThan(0);
  });

  it('multiple sources merge into one cluster and one rebuilt event', () => {
    const official = contributionFromCandidate(
      baseCandidate({
        sourceId: 'src-official',
        externalId: 'off-1',
        eventUrl: 'https://bootshaus.club/events/test',
        mappedEventId: undefined,
      }),
      { mappedEventId: 'evt-1', mappingMethod: 'import_record' },
    );
    const ticket = contributionFromCandidate(
      baseCandidate({
        sourceId: 'src-ticket',
        externalId: 'tk-1',
        sourceMetadata: {
          platform: 'ticket_kings',
          connectorKey: 'ticket_platform',
          verifiedAt: '2026-08-01T00:00:00.000Z',
          publicCtaCandidateUrl: 'https://ticketkings.de/event/test',
          listRowTitle: 'Test Event',
          eventDate: '2026-09-05',
          venueName: 'Bootshaus',
          priceText: 'ab 23,90 €',
        },
      }),
      { mappedEventId: 'evt-1', mappingMethod: 'import_record' },
    );
    const clusters = buildIdentityClusters([official, ticket], []);
    expect(clusters.length).toBe(1);
    expect(clusters[0]?.contributionKeys.length).toBe(2);
  });

  it('different events are not mixed into one cluster', () => {
    const left = contributionFromCandidate(
      baseCandidate({ title: 'LEVI Night', externalId: 'a' }),
      { mappedEventId: 'evt-a' },
    );
    const right = contributionFromCandidate(
      baseCandidate({
        title: 'R3HAB Night',
        externalId: 'b',
        startDate: '2026-10-01T20:00:00.000Z',
        sourceMetadata: {
          pageTitle: 'R3HAB Night',
          eventDate: '2026-10-01',
          verifiedAt: '2026-08-01T00:00:00.000Z',
        },
      }),
      { mappedEventId: 'evt-b' },
    );
    const clusters = buildIdentityClusters([left, right], []);
    expect(clusters.length).toBe(2);
  });

  it('missing optional description does not block secure publish core', () => {
    const contribution = contributionFromCandidate(baseCandidate({ description: undefined }));
    const rebuilt = assembleRebuiltCanonicalEvent({
      contributions: [contribution],
      collisionContributionKeys: [],
      eventId: 'evt-core',
    });
    const core = assessPublishCore(rebuilt, [contribution]);
    const disposition = classifyDisposition({
      existing: { id: 'evt-core', title: 'x', description: '', startDate: rebuilt.startDate! } as AdminEventRecord,
      rebuilt,
      changeSet: {},
      hasCollision: false,
      hasContamination: false,
      publishCore: core,
      identityVerdicts: ['exact'],
      manualLocks: [],
      hasContributions: true,
    });
    expect(core.secure).toBe(true);
    expect(disposition === 'ready_partial' || disposition === 'ready_update' || disposition === 'ready_unchanged').toBe(
      true,
    );
  });

  it('synthetic title conflict yields review_collision', () => {
    const existing = {
      id: 'evt-mdma',
      title: 'MDMA – Musik Die Mich Antreibt',
      startDate: '2026-10-09T20:30:00+00:00',
      description: '',
    } as AdminEventRecord;
    const contribution = contributionFromCandidate(
      baseCandidate({
        title: 'CHROME @ Bootshaus',
        sourceMetadata: {
          pageTitle: 'CHROME @ Bootshaus',
          listRowTitle: 'CHROME @ Bootshaus',
          eventDate: '2026-10-09',
          venueName: 'Bootshaus',
          verifiedAt: '2026-08-01T00:00:00.000Z',
          publicCtaCandidateUrl: 'https://bootshaus-club.ticket.io/Atz0dHLX/',
        },
      }),
      {
        mappedEventId: 'evt-mdma',
        mappingMethod: 'import_record',
        identityVerdict: 'mismatch',
        identityReason: 'title_mismatch',
      },
    );
    const assessment = assessContributionCollisions([contribution], existing);
    expect(assessment.hasCollision).toBe(true);
    const clusters = buildIdentityClusters([contribution], [existing]);
    expect(clusters[0]?.clusterVerdict).toBe('review_collision');
  });

  it('checkout embed is flagged as consumer quality issue', () => {
    const event = {
      id: 'evt-checkout',
      title: 'Checkout Event',
      description: '',
      startDate: '2026-01-01T00:00:00.000Z',
      ticketUrl: 'https://nacht-manager.de/ticketing/native_event.php?id=1&embed=1',
      ticketStatus: 'on_sale',
    } as AdminEventRecord;
    const quality = auditConsumerQuality(event);
    expect(quality.checks.noCheckoutAsCta).toBe(false);
  });

  it('acceptance uses rebuilt only without db fallback merge', () => {
    const row: BulkRebuildEventRow = {
      eventIdBefore: 'evt-1785339421539-k3swcrl',
      disposition: 'ready_partial',
      idPreservation: 'preserve_existing_id',
      existing: {
        id: 'evt-1785339421539-k3swcrl',
        title: 'OLD TITLE FROM DB',
        description: 'OLD DESC',
        startDate: '2020-01-01T00:00:00.000Z',
        priceText: 'OLD PRICE',
        ticketUrl: 'https://wrong.example',
        ticketStatus: 'external_link',
      } as AdminEventRecord,
      rebuilt: {
        evidenceByFieldGroup: { tickets: ['ticket_platform_metadata'] },
        title: 'R3HAB LIVE',
        startDate: '2026-09-01T20:00:00.000Z',
        priceText: 'ab 23,90 €',
        ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        ticketStatus: 'on_sale',
        verifiedAt: '2026-08-01T00:00:00.000Z',
        publishCoreSecure: true,
      },
      sourceContributions: [],
      changeSet: {},
      manualLocks: [],
      reviewReasons: [],
    };
    const audit = runAcceptanceAudit([row], []);
    const r3hab = audit.results.find((result) => result.key === 'R3HAB');
    expect(r3hab?.checks.price2390).toBe(true);
    expect(r3hab?.checks.ticketIoCta).toBe(true);
  });

  it('collision blocks id preservation remapping', () => {
    const decision = resolveIdPreservation({
      existing: { id: 'evt-1' } as AdminEventRecord,
      hasCollision: true,
      identityVerdicts: ['exact'],
      publishCoreSecure: true,
    });
    expect(decision).toBe('no_safe_mapping');
  });

  it('combines official and ticket field groups without overwriting websiteUrl', () => {
    const official = contributionFromCandidate(
      baseCandidate({
        sourceId: 'src-official',
        externalId: 'off-1',
        eventUrl: 'https://bootshaus.club/events/test',
        sourceMetadata: {
          connector: 'website',
          officialDescription: 'Official page description',
          verifiedAt: '2026-08-01T00:00:00.000Z',
        },
      }),
    );
    const ticket = contributionFromCandidate(
      baseCandidate({
        sourceId: 'src-ticket',
        externalId: 'tk-1',
        sourceMetadata: {
          platform: 'ticket_kings',
          connectorKey: 'ticket_platform',
          verifiedAt: '2026-08-01T00:00:00.000Z',
          publicCtaCandidateUrl: 'https://ticketkings.de/event/test',
          listRowTitle: 'Test Event',
          eventDate: '2026-09-05',
          priceText: 'ab 23,90 €',
        },
      }),
    );
    const rebuilt = assembleRebuiltCanonicalEvent({
      contributions: [official, ticket],
      collisionContributionKeys: [],
      eventId: 'evt-merge',
    });
    expect(rebuilt.websiteUrl).toContain('bootshaus.club');
    expect(rebuilt.ticketUrl).toContain('ticketkings.de');
  });
});
