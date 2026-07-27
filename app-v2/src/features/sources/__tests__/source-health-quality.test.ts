import { describe, expect, it } from 'vitest';

import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  mapSourceRecordToRegistryEntry,
  type SourceRegistryEntry,
} from '@/features/sources/domain/source-registry';
import { SourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import { SourceQualityResolver } from '@/features/sources/domain/source-quality-resolver';
import { SourceLifecycleResolver } from '@/features/sources/domain/source-lifecycle-resolver';
import type { SourceRecord } from '@/data/types/records';

function sourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-club',
    slug: 'club-example',
    displayName: 'Club Example',
    sourceType: 'website',
    parserType: 'json-ld',
    acquisitionStrategy: 'scheduled',
    priority: 80,
    trustScore: 75,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function registryEntry(overrides: Partial<SourceRegistryEntry> = {}): SourceRegistryEntry {
  return {
    ...mapSourceRecordToRegistryEntry(sourceRecord()),
    totalImportCount: 10,
    totalValidEventCount: 90,
    totalRejectedEventCount: 10,
    errorRate: 0.05,
    duplicateRate: 0.05,
    lastSuccessfulSyncAt: '2026-07-25T10:00:00.000Z',
    ...overrides,
  };
}

function event(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'event-1',
    importId: 'event-1',
    title: 'Complete Event',
    description: 'A complete event description.',
    startDate: '2026-08-10T20:00:00.000Z',
    endDate: '2026-08-11T02:00:00.000Z',
    venueName: 'Club Example',
    cityName: 'Berlin',
    countryCode: 'DE',
    latitude: 52.52,
    longitude: 13.405,
    genreNames: ['Techno'],
    artistNames: ['Artist'],
    organizerName: 'Organizer',
    ticketUrl: 'https://tickets.example/event',
    originalLink: 'https://club.example/event',
    imageUrl: 'https://club.example/event.jpg',
    sourceId: 'source-club',
    sourceName: 'Club Example',
    rawSourceType: 'unknown',
    ...overrides,
  };
}

describe('source registry quality and health', () => {
  it('maps existing source records without creating a parallel source model', () => {
    const entry = mapSourceRecordToRegistryEntry(sourceRecord());
    expect(entry.stableKey).toBe('club-example');
    expect(entry.sourceType).toBe('club_website');
    expect(entry.status).toBe('active');
  });

  it('calculates healthy status from observed import metrics', () => {
    const result = new SourceHealthResolver().resolve(
      registryEntry(),
      new Date('2026-07-26T10:00:00.000Z'),
    );
    expect(result.status).toBe('healthy');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('marks repeated failures critical without inventing metrics', () => {
    const result = new SourceHealthResolver().resolve(
      registryEntry({
        consecutiveFailureCount: 5,
        errorRate: 0.8,
      }),
      new Date('2026-07-26T10:00:00.000Z'),
    );
    expect(result.status).toBe('critical');
    expect(result.reasons.join(' ')).toContain('Repeated import failures');
  });

  it('keeps health unknown when no import history exists', () => {
    const result = new SourceHealthResolver().resolve(registryEntry({ totalImportCount: 0 }));
    expect(result.status).toBe('unknown');
    expect(result.score).toBe(0);
  });

  it('calculates source quality from canonical event completeness', () => {
    const result = new SourceQualityResolver().resolve([event()]);
    expect(result.tier).toBe('A');
    expect(result.missingFields).toEqual([]);
  });

  it('reports missing event data separately from technical health', () => {
    const result = new SourceQualityResolver().resolve([
      event({
        description: undefined,
        imageUrl: undefined,
        ticketUrl: undefined,
        artistNames: [],
      }),
    ]);
    expect(result.qualityScore).toBeLessThan(85);
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['description', 'image', 'ticket', 'lineup']),
    );
  });

  it('pauses a source only after the configured repeated failure threshold', () => {
    const resolver = new SourceLifecycleResolver();
    expect(
      resolver.resolve({
        currentStatus: 'active',
        consecutiveFailureCount: 1,
        warningCount: 0,
        successfulRun: false,
      }).nextStatus,
    ).toBe('active');
    expect(
      resolver.resolve({
        currentStatus: 'active',
        consecutiveFailureCount: 5,
        warningCount: 0,
        successfulRun: false,
      }).nextStatus,
    ).toBe('paused');
  });
});
