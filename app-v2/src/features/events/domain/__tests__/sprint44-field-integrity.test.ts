import { describe, expect, it } from 'vitest';

import { resolveFillOnlyText } from '@/features/aggregation/connectors/ticket-platform/ticket-io-repair';
import { ImportUpdateService } from '@/features/aggregation/services/import-update-service';
import { SOURCE_FIELD_OWNERSHIP_MATRIX } from '@/features/events/domain/source-field-ownership-matrix';
import {
  projectCanonicalEventFields,
  resolveKnownArtistNames,
} from '@/features/events/formatting/canonical-event-projection';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

describe('phase 4.4 field integrity', () => {
  const importUpdateService = new ImportUpdateService();

  it('never downgrades website description during ticket.io enrichment', () => {
    const existing: AdminEventRecord = {
      id: 'evt-1',
      title: 'PLAY! Open Air',
      description: 'Official Bootshaus website description with full event copy.',
      startDate: '2026-08-01T20:00:00.000Z',
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const candidate = {
      title: 'PLAY! Open Air',
      description: 'N/A',
      priceText: 'ab 15,00 €',
      startDate: '2026-08-01T20:00:00.000Z',
      sourceId: 'source-bootshaus-ticket-io',
    } as CanonicalImportEvent;

    const enriched = importUpdateService.buildEnrichmentAdminEvent(existing, candidate);
    expect(enriched.description).toBe('Official Bootshaus website description with full event copy.');
    expect(enriched.priceText).toBe('ab 15,00 €');
  });

  it('preserves placeholder text instead of clearing to empty during enrichment', () => {
    expect(resolveFillOnlyText('N/A', undefined)).toBe('N/A');
    expect(resolveFillOnlyText('', undefined)).toBe('');
    expect(resolveFillOnlyText('N/A', 'Recovered detail description')).toBe('Recovered detail description');
  });

  it('rejects placeholder overwrite in fill-only change detection', () => {
    const existing: AdminEventRecord = {
      id: 'evt-2',
      title: 'Event',
      description: 'Keep me',
      startDate: '2026-08-01T20:00:00.000Z',
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const candidate = {
      title: 'Event',
      description: 'N/A',
      startDate: '2026-08-01T20:00:00.000Z',
      sourceId: 'source-bootshaus-ticket-io',
    } as CanonicalImportEvent;

    const changes = importUpdateService.detectChanges(candidate, existing, { fillOnly: true });
    expect(changes.changedFields).not.toContain('description');
  });

  it('does not synthesize artists from event title when lineup is missing', () => {
    expect(
      resolveKnownArtistNames({
        title: 'SAVE THE RAVE OPEN AIR ft. WESTBAM & K-PAUL',
        artists: [],
        lineup: [],
      }),
    ).toEqual([]);
  });

  it('projects empty lineup completeness when no canonical evidence exists', () => {
    const projection = projectCanonicalEventFields({
      title: '122 pres. JUNO @ Palma de Mallorca (ES)',
      description: '',
      venue: 'TBA',
      city: 'Palma de Mallorca',
      artists: [],
      lineup: [],
      source: 'source-bootshaus-koeln',
    });
    expect(projection.knownArtistNames).toEqual([]);
    expect(projection.lineupCompleteness).toBe('none');
    expect(projection.hasKnownLineup).toBe(false);
  });

  it('defines explicit per-field source ownership matrix', () => {
    const description = SOURCE_FIELD_OWNERSHIP_MATRIX.find((entry) => entry.field === 'description');
    const ticketUrl = SOURCE_FIELD_OWNERSHIP_MATRIX.find((entry) => entry.field === 'ticketUrl');
    expect(description?.website).toBe(5);
    expect(description?.mergeRule).toBe('never_downgrade');
    expect(ticketUrl?.ticketIo).toBe(5);
    expect(ticketUrl?.website).toBe(2);
  });
});
