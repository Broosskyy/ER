import { describe, expect, it } from 'vitest';

import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { projectEventAttributeBadges } from '@/features/events/domain/event-attribute-badge-projection';
import { buildEventAttributeCandidatesFromImport } from '@/features/events/domain/event-attribute-candidates';
import {
  buildCanonicalAttributeBundleFromImport,
  mergeEventAttributeCandidates,
  serializeCanonicalEventAttributes,
} from '@/features/events/domain/event-attribute-merge';
import { auditEventAttributeQuality } from '@/features/events/domain/event-attribute-quality-rules';

function importCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    sourceId: 'source-affenkaefig',
    sourceName: 'Affenkäfig',
    externalId: 'ext-1',
    rawSourceType: 'website',
    title: 'Sommerfest Elektroküche',
    description: 'Open Air Party auf 2 Floors. Mindestalter: 18+.',
    startDate: '2026-08-08T20:00:00+02:00',
    sourceMetadata: {
      eventAttributes: [
        { key: 'open_air', label: 'Open Air', source: 'description_text', confidence: 0.85 },
        { key: 'multi_floor', label: '2 Floors', value: 2, source: 'description_text', confidence: 0.85 },
      ],
      floorCount: 2,
      venueEnvironment: 'outdoor',
    },
    ...overrides,
  };
}

describe('phase473 canonical event attributes', () => {
  it('builds structured attribute candidates from connector metadata', () => {
    const candidates = buildEventAttributeCandidatesFromImport(importCandidate());
    expect(candidates.some((entry) => entry.type === 'open_air')).toBe(true);
    expect(candidates.some((entry) => entry.type === 'floor_count')).toBe(true);
    expect(candidates[0]?.provenance.extractionStrategy).toBeTruthy();
  });

  it('merges candidates with stronger explicit evidence winning', () => {
    const incoming = buildEventAttributeCandidatesFromImport(importCandidate());
    const bundle = mergeEventAttributeCandidates({ incoming });
    expect(bundle.attributes.some((entry) => entry.type === 'open_air')).toBe(true);
    expect(bundle.floorCount).toBe(2);
    expect(bundle.venueEnvironment).toBe('outdoor');
  });

  it('flags conflicting explicit evidence for review', () => {
    const bundle = mergeEventAttributeCandidates({
      existing: [
        {
          type: 'open_air',
          label: 'Open Air',
          value: 'lake',
          domain: 'venue_environment',
          confidence: 0.9,
          provenance: {
            extractionStrategy: 'legacy',
            origins: ['source-a'],
          },
        },
      ],
      incoming: [
        {
          type: 'open_air',
          label: 'Open Air',
          normalizedValue: 'warehouse yard',
          domain: 'venue_environment',
          extractionStrategy: 'test',
          source: 'source-b',
          origin: 'source-b',
          confidence: 0.95,
          explicit: true,
          provenance: { extractionStrategy: 'test', origin: 'source-b' },
        },
      ],
    });
    expect(bundle.reviewRequired).toBe(true);
    expect(bundle.conflicts?.length).toBeGreaterThan(0);
  });

  it('preserves provenance through serialization', () => {
    const bundle = buildCanonicalAttributeBundleFromImport({ candidate: importCandidate() });
    const serialized = serializeCanonicalEventAttributes(bundle.attributes);
    expect(serialized[0]?.provenance.extractionStrategy).toBeTruthy();
  });

  it('projects consumer badges only from canonical attributes', () => {
    const bundle = buildCanonicalAttributeBundleFromImport({ candidate: importCandidate() });
    const badges = projectEventAttributeBadges(bundle.attributes, { floorCount: bundle.floorCount });
    expect(badges.some((badge) => badge.label === 'Open Air')).toBe(true);
    expect(badges.some((badge) => badge.type === 'floor_count')).toBe(true);
    expect(badges.some((badge) => badge.label === 'Featured')).toBe(false);
  });

  it('detects boat attribute from ship title without connector changes', () => {
    const bundle = buildCanonicalAttributeBundleFromImport({
      candidate: importCandidate({
        title: 'Bootshaus on a Ship Vol. III',
        description: 'Electronic music cruise.',
        sourceMetadata: {},
      }),
    });
    expect(bundle.attributes.some((entry) => entry.type === 'boat')).toBe(true);
  });

  it('projects badges into event detail hero view model', () => {
    const badges = projectEventAttributeBadges(
      [
        {
          type: 'indoor',
          label: 'Indoor',
          value: true,
          domain: 'venue_environment',
          confidence: 0.9,
          provenance: { extractionStrategy: 'test', origins: ['source'] },
        },
      ],
      undefined,
    );
    expect(badges.some((badge) => badge.label === 'Indoor')).toBe(true);
  });

  it('audits schema gaps when candidates exist but event has no persisted attributes', () => {
    const violations = auditEventAttributeQuality({
      event: {
        id: 'evt-1',
        title: 'Sommerfest',
        description: '',
        startDate: '2026-08-08T20:00:00+02:00',
        status: 'published',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      candidate: importCandidate(),
    });
    expect(violations.some((entry) => entry.stage === 'schema_column_missing')).toBe(true);
  });

  it('merge is idempotent for identical incoming candidates', () => {
    const first = buildCanonicalAttributeBundleFromImport({ candidate: importCandidate() });
    const second = mergeEventAttributeCandidates({
      existing: first.attributes,
      incoming: buildEventAttributeCandidatesFromImport(importCandidate()),
    });
    expect(second.attributes.map((entry) => entry.type).sort()).toEqual(
      first.attributes.map((entry) => entry.type).sort(),
    );
  });
});
