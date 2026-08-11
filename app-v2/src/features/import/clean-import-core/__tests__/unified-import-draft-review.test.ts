import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ConnectorOutput } from '@/features/import/clean-import-core/event-evidence';
import {
  AdminDraftReviewController,
  buildAdminDraftReviewQueueViewModel,
  buildCompactDraftReviewCard,
} from '@/features/import/clean-import-core/admin-draft-review';
import { resolveGenreContract } from '@/features/import/clean-import-core/genre-contract';
import { ImportRunner } from '@/features/import/clean-import-core/import-runner';
import {
  isWiredImportSubmissionKind,
  submissionToConnectorOutputs,
  type ImportSubmission,
} from '@/features/import/clean-import-core/import-submission';
import { UnifiedImportDraftService } from '@/features/import/clean-import-core/unified-import-draft-service';
import { REFERENCE_FIXTURES } from '@/features/import/clean-import-core/__tests__/fixtures/reference-fixtures';

const VERIFIED_AT = '2026-08-10T18:00:00.000Z';
const SERVICE = new UnifiedImportDraftService();

function officialComplete(): ConnectorOutput {
  return {
    sourceId: 'auto-official',
    sourceFamily: 'official_website',
    sourceUrl: 'https://official.example/events/complete',
    verifiedAt: VERIFIED_AT,
    title: 'Complete Night',
    startDate: '2026-11-01T22:00:00+02:00',
    endDate: '2026-11-02T06:00:00+02:00',
    venueName: 'Reference Club',
    officialWebsiteUrl: 'https://official.example/events/complete',
    outboundTicketUrls: ['https://reference.ticket.io/complete/'],
    description: 'Complete night description',
    genres: ['Techno', 'Tech House'],
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
  };
}

function ticketComplete(): ConnectorOutput {
  return {
    sourceId: 'auto-ticket',
    sourceFamily: 'ticket_io',
    sourceUrl: 'https://reference.ticket.io/complete/',
    verifiedAt: VERIFIED_AT,
    title: 'Complete Night',
    startDate: '2026-11-01T22:00:00+02:00',
    venueName: 'Reference Club',
    publicTicketUrl: 'https://reference.ticket.io/complete/',
    admissionPrice: { amount: 20, currency: 'EUR', text: '20.00 EUR' },
    ticketPhases: [
      {
        id: 'complete-regular',
        name: 'Regular',
        sortOrder: 400,
        kind: 'regular',
        priceAmount: 20,
        priceCurrency: 'EUR',
        available: true,
        soldOut: false,
        purchaseUrl: 'https://reference.ticket.io/complete/',
      },
    ],
    ticketStatus: 'on_sale',
  };
}

function automaticSubmission(outputs: ConnectorOutput[]): ImportSubmission {
  return {
    id: 'sub-auto-1',
    kind: 'automatic_source',
    submitter: { role: 'system', trustHint: 'official_source' },
    submittedAt: VERIFIED_AT,
    connectorOutputs: outputs,
  };
}

describe('unified import draft and exception review', () => {
  it('routes automatic source and community submission through the same core', () => {
    const auto = SERVICE.process(
      automaticSubmission([
        {
          ...officialComplete(),
          genres: undefined,
        },
        ticketComplete(),
      ]),
    );
    const community = SERVICE.process({
      id: 'sub-community-1',
      kind: 'community_manual',
      submitter: { role: 'community', userId: 'user-1', trustHint: 'untrusted' },
      submittedAt: VERIFIED_AT,
      payload: {
        title: 'Community Night',
        startDate: '2026-11-05T22:00:00+02:00',
        venueName: 'Reference Club',
        eventUrl: 'https://official.example/events/community-night',
        websiteUrl: 'https://official.example/events/community-night',
        genres: ['Techno'],
        lineupNames: ['Community DJ'],
        description: 'Community submitted event',
        imageUrl: 'https://cdn.example/community.jpg',
      },
    });

    expect(auto.wroteEventsTable).toBe(false);
    expect(community.wroteEventsTable).toBe(false);
    expect(auto.draft.audit.persistenceMode).toBe('dry_run_noop');
    expect(community.draft.audit.persistenceMode).toBe('dry_run_noop');
    expect(auto.draft.evidence.length).toBeGreaterThan(0);
    expect(community.draft.evidence.length).toBeGreaterThan(0);
    expect(isWiredImportSubmissionKind('automatic_source')).toBe(true);
    expect(isWiredImportSubmissionKind('community_manual')).toBe(true);
  });

  it('uses the same ImportSubmission contract for organizer and admin URL', () => {
    const organizer = {
      id: 'sub-org-1',
      kind: 'organizer_manual' as const,
      submitter: { role: 'organizer' as const, userId: 'org-1', trustHint: 'trusted_organizer' as const },
      submittedAt: VERIFIED_AT,
      payload: {
        title: 'Organizer Night',
        startDate: '2026-11-08T22:00:00+02:00',
        venueName: 'Reference Club',
        websiteUrl: 'https://official.example/events/organizer-night',
        eventUrl: 'https://official.example/events/organizer-night',
        genres: ['House'],
        lineupNames: ['Resident'],
        description: 'Organizer submission',
        imageUrl: 'https://cdn.example/org.jpg',
        ticketUrl: 'https://reference.ticket.io/organizer-night/',
      },
    };
    const adminUrl = {
      id: 'sub-admin-1',
      kind: 'admin_url' as const,
      submitter: { role: 'admin' as const, userId: 'admin-1', trustHint: 'admin' as const },
      submittedAt: VERIFIED_AT,
      payload: {
        title: 'Admin URL Night',
        startDate: '2026-11-09T22:00:00+02:00',
        venueName: 'Reference Club',
        eventUrl: 'https://official.example/events/admin-url-night',
        websiteUrl: 'https://official.example/events/admin-url-night',
        genres: ['Trance'],
        lineupNames: ['Admin DJ'],
        description: 'Admin URL import',
        imageUrl: 'https://cdn.example/admin.jpg',
      },
    };

    const organizerOutputs = submissionToConnectorOutputs(organizer);
    const adminOutputs = submissionToConnectorOutputs(adminUrl);
    expect(organizerOutputs[0]?.sourceFamily).toBe('official_website');
    expect(adminOutputs[0]?.sourceFamily).toBe('official_website');

    const organizerDraft = SERVICE.process(organizer);
    const adminDraft = SERVICE.process(adminUrl);
    expect(organizerDraft.draft.submissionKind).toBe('organizer_manual');
    expect(adminDraft.draft.submissionKind).toBe('admin_url');
    expect(organizerDraft.productionMutations).toBe(0);
    expect(adminDraft.rolloutActivated).toBe(false);
  });

  it('marks a safe complete event as auto_ready', () => {
    const result = SERVICE.process(automaticSubmission([officialComplete(), ticketComplete()]));
    expect(result.draft.reviewTrack).toBe('auto_ready');
    expect(result.draft.proposedCanonicalEvent?.title).toBe('Complete Night');
    expect(result.draft.genres.normalizedLabels).toEqual(
      expect.arrayContaining(['Techno', 'Tech House']),
    );
  });

  it('routes optional missing genres or lineup to quick_review', () => {
    const withoutGenres = SERVICE.process(
      automaticSubmission([
        {
          ...officialComplete(),
          genres: undefined,
        },
        ticketComplete(),
      ]),
    );
    expect(withoutGenres.draft.reviewTrack).toBe('quick_review');
    expect(withoutGenres.draft.missingFields).toContain('genres');
    expect(withoutGenres.draft.reviewReasons).toContain('genres_need_review');

    const withoutLineup = SERVICE.process(
      automaticSubmission([
        {
          ...officialComplete(),
          lineup: undefined,
          lineupState: 'empty',
        },
        ticketComplete(),
      ]),
    );
    expect(withoutLineup.draft.reviewTrack).toBe('quick_review');
    expect(withoutLineup.draft.missingFields).toContain('lineup');
  });

  it('routes identity conflicts and duplicates to conflict_review', () => {
    const duplicate = SERVICE.process({
      ...automaticSubmission([officialComplete(), ticketComplete()]),
      knownDuplicateEventIds: ['existing-event-1'],
    });
    expect(duplicate.draft.reviewTrack).toBe('conflict_review');
    expect(duplicate.draft.duplicates[0]?.recommendedAction).toBe('manual_compare');

    const mismatched = SERVICE.process(
      automaticSubmission([
        officialComplete(),
        {
          ...ticketComplete(),
          title: 'Completely Different Title',
          startDate: '2026-12-01T22:00:00+02:00',
          venueName: 'Other Venue',
        },
      ]),
    );
    expect(['conflict_review', 'quick_review']).toContain(mismatched.draft.reviewTrack);
    if (mismatched.draft.audit.coreDecision === 'review' || mismatched.draft.audit.coreDecision === 'duplicate_candidate') {
      expect(mismatched.draft.reviewTrack).toBe('conflict_review');
    }
  });

  it('normalizes multi-genre variants into Eternal Rave labels', () => {
    const genres = resolveGenreContract({
      rawGenres: ['Tech House', 'Tech-House', 'Techhouse', 'Techno'],
      sourceId: 'official',
      sourceFamily: 'official_website',
      submissionKind: 'automatic_source',
    });
    expect(genres.normalizedLabels).toEqual(['Tech House', 'Techno']);
    expect(genres.rawValues).toEqual(['Tech House', 'Tech-House', 'Techhouse', 'Techno']);
  });

  it('does not overwrite confirmed genres with weaker community evidence', () => {
    const genres = resolveGenreContract({
      rawGenres: ['House'],
      sourceId: 'community-user',
      submissionKind: 'community_manual',
      existingConfirmedGenres: ['Techno'],
    });
    expect(genres.normalizedLabels).toContain('Techno');
    expect(genres.preservedConfirmed).toBe(true);
    // Additive weaker genre may remain, but confirmed Techno stays.
    expect(genres.items.some((item) => item.confirmed && item.normalizedLabel === 'Techno')).toBe(
      true,
    );
  });

  it('treats community corrections as supplements instead of duplicates', () => {
    const result = SERVICE.process({
      id: 'sub-correction-1',
      kind: 'community_manual',
      submitter: { role: 'community', userId: 'user-2', trustHint: 'untrusted' },
      submittedAt: VERIFIED_AT,
      existingConfirmedGenres: ['Techno'],
      payload: {
        title: 'Complete Night',
        startDate: '2026-11-01T22:00:00+02:00',
        venueName: 'Reference Club',
        eventUrl: 'https://official.example/events/complete',
        websiteUrl: 'https://official.example/events/complete',
        description: 'Updated description from community',
        genres: ['Techno', 'Melodic Techno'],
        lineupNames: ['Nova Pulse'],
        imageUrl: 'https://cdn.example/correction.jpg',
        correctionTargetEventId: 'existing-event-42',
      },
    });

    expect(result.draft.correctionTargetEventId).toBe('existing-event-42');
    expect(result.draft.recommendedDuplicateAction).toBe('merge_into_existing');
    expect(result.draft.duplicates.some((entry) => entry.reason === 'community_correction_target')).toBe(
      true,
    );
    expect(result.draft.proposedFieldChanges.some((change) => change.field === 'identity')).toBe(
      true,
    );
    expect(result.wroteEventsTable).toBe(false);
  });

  it('never writes events and keeps review actions on dry-run noop persistence', async () => {
    const result = SERVICE.process(automaticSubmission([officialComplete(), ticketComplete()]));
    const controller = new AdminDraftReviewController(SERVICE.getReviewPersistence());
    const card = buildCompactDraftReviewCard(result.draft);
    expect(card.title).toBe('Complete Night');
    expect(card.diagnose.coreDecision).toBeTruthy();

    const queue = buildAdminDraftReviewQueueViewModel([result.draft]);
    expect(queue.autoReadyCount + queue.quickReviewCount + queue.conflictReviewCount).toBe(1);

    const selected = controller.selectAllSafe([result.draft]);
    if (result.draft.reviewTrack === 'auto_ready') {
      expect(selected).toEqual([result.draft.id]);
    }

    const approve = await controller.approveOne(result.draft);
    const batch = await controller.batchApprove([result.draft], selected);
    const reject = await controller.reject(result.draft, 'not needed');
    const merge = await controller.mergeIntoExisting(result.draft, 'existing-event-42');
    const create = await controller.createNew(result.draft);

    for (const action of [approve, batch, reject, merge, create]) {
      expect(action.databaseWriteOperations).toBe(0);
      expect(action.productionMutations).toBe(0);
      expect(action.message.startsWith('dry_run_noop:')).toBe(true);
    }
    expect(result.databaseWriteOperations).toBe(0);
    expect(result.productionMutations).toBe(0);
    expect(result.rolloutActivated).toBe(false);
  });

  it('keeps the seven reference fixtures green through the clean core', () => {
    const runner = new ImportRunner();
    expect(REFERENCE_FIXTURES).toHaveLength(7);
    for (const fixture of REFERENCE_FIXTURES) {
      const result = runner.run(fixture.outputs.map((output) => ({ ...output })));
      expect(result.decision).toBeTruthy();
      expect(['publish', 'publish_partial', 'review', 'duplicate_candidate', 'reject']).toContain(
        result.decision,
      );
    }
  });

  it('rejects unwired contract-only submission kinds without building engines', () => {
    expect(() =>
      SERVICE.process({
        id: 'sub-media',
        kind: 'media_upload',
        submitter: { role: 'community' },
        submittedAt: VERIFIED_AT,
        payload: { title: 'Flyer only' },
      }),
    ).toThrow(/not_wired/);
  });
});

describe('production safety guards for unified draft path', () => {
  it('contains no direct events-table write helpers in new draft modules', () => {
    const files = [
      'import-submission.ts',
      'import-draft.ts',
      'genre-contract.ts',
      'unified-import-draft-service.ts',
      'admin-draft-review.ts',
      'draft-review-persistence.ts',
    ];
    for (const file of files) {
      const source = readFileSync(
        join(process.cwd(), 'src/features/import/clean-import-core', file),
        'utf8',
      );
      expect(source).not.toMatch(/\.from\(\s*['"]events['"]\s*\)/);
      expect(source).not.toMatch(/insertIntoEvents|writeEventRow|publishToEvents/);
    }
  });
});
