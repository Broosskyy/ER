import { describe, expect, it } from 'vitest';

import {
  buildEntityCandidateKey,
  buildEntityResolutionWritebackPlan,
  InMemoryEntityAliasStore,
  normalizeIdentityText,
} from '@/features/entity-resolution';
import { EntityResolutionWritebackService } from '@/features/entity-resolution/entity-resolution-writeback-service';
import type { ImportRecord } from '@/features/import/models/types';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

const candidate: NormalizedEventCandidate = {
  externalId: 'ext-venue-1',
  sourceId: 'source-a',
  title: 'Techno Night',
  startDate: '2026-08-15T20:00:00.000Z',
  cityName: 'Köln',
  venueName: 'Bootshaus',
  venueAddress: 'Auenweg 173',
  artistNames: ['Ben Klock'],
  organizerName: 'Boiler Room',
  rawSourceType: 'json_ld',
  sourceMetadata: {
    externalVenueId: 'venue-ext-1',
    externalOrganizerId: 'org-ext-1',
    externalArtistId: 'artist-ext-1',
  },
};

const baseRecord: ImportRecord = {
  id: 'rec-1',
  importJobId: 'job-1',
  sourceId: 'source-a',
  externalId: 'ext-venue-1',
  rawPayload: {},
  normalizedPayload: candidate as unknown as Record<string, unknown>,
  matchedVenueId: 'venue-auto',
  matchedOrganizerId: 'org-auto',
  matchedArtistIds: ['artist-auto'],
  status: 'needs_review',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('entity resolution writeback plan', () => {
  it('creates manual_override decision and aliases on edit', () => {
    const plan = buildEntityResolutionWritebackPlan({
      record: baseRecord,
      candidate,
      actorId: 'admin-1',
      trigger: 'edit',
      edits: {
        matchedVenueId: 'venue-manual',
      },
      now: '2026-01-02T00:00:00.000Z',
    });

    expect(plan.decisions).toHaveLength(1);
    expect(plan.decisions[0]).toMatchObject({
      entityType: 'venue',
      decision: 'manual_override',
      canonicalId: 'venue-manual',
      decidedBy: 'admin-1',
    });
    expect(plan.aliases.some((alias) => alias.aliasType === 'normalized_name')).toBe(true);
    expect(plan.aliases.some((alias) => alias.aliasType === 'external_id')).toBe(true);
  });

  it('creates keep_separate decision for venue', () => {
    const plan = buildEntityResolutionWritebackPlan({
      record: baseRecord,
      candidate,
      actorId: 'admin-1',
      trigger: 'edit',
      edits: {
        keepSeparateVenue: true,
      },
      now: '2026-01-02T00:00:00.000Z',
    });

    expect(plan.decisions).toHaveLength(1);
    expect(plan.decisions[0]).toMatchObject({
      entityType: 'venue',
      decision: 'keep_separate',
    });
    expect(plan.aliases).toHaveLength(0);
  });

  it('confirms aliases on approve without reviewer override decision', () => {
    const plan = buildEntityResolutionWritebackPlan({
      record: baseRecord,
      candidate,
      actorId: 'admin-1',
      trigger: 'approve',
      now: '2026-01-02T00:00:00.000Z',
    });

    expect(plan.decisions).toHaveLength(0);
    expect(plan.aliases.length).toBeGreaterThan(0);
    expect(plan.aliases.every((alias) => alias.canonicalId === 'venue-auto' || alias.canonicalId === 'org-auto' || alias.canonicalId === 'artist-auto')).toBe(true);
  });

  it('is idempotent when persisting the same plan twice', async () => {
    const aliasStore = new InMemoryEntityAliasStore();
    const service = new EntityResolutionWritebackService(aliasStore, async () => undefined);
    const context = {
      record: baseRecord,
      candidate,
      actorId: 'admin-1',
      trigger: 'edit' as const,
      edits: {
        matchedVenueId: 'venue-manual',
      },
      now: '2026-01-02T00:00:00.000Z',
    };

    await service.persist(context);
    await service.persist(context);

    const candidateKey = buildEntityCandidateKey({
      sourceId: 'source-a',
      externalId: 'venue-ext-1',
      name: 'Bootshaus',
      address: 'Auenweg 173',
      city: 'Köln',
    });

    expect(aliasStore.getDecision('venue', candidateKey)?.canonicalId).toBe('venue-manual');
    expect(
      aliasStore.findCanonicalId(
        'venue',
        'normalized_name',
        normalizeIdentityText('Bootshaus'),
        'source-a',
      ),
    ).toBe('venue-manual');
  });
});
