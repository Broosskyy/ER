import { describe, expect, it, vi } from 'vitest';

import {
  decodeJwtPayloadUnsafe,
  isJwtIssuedAtFutureError,
  measureClockSkewAgainstHttpDate,
} from '@/services/supabase/jwt-clock-skew';
import {
  extractTitleDerivedArtistNames,
  resolveTitleLineupArtistIds,
  TITLE_LINEUP_SAFE_MATCH_THRESHOLD,
} from '@/features/import/services/import-title-lineup-resolver';
import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import type { ImportRecord } from '@/features/import/models/types';
import {
  formatDisplayPriceText,
  formatTicketPriceFromOverviewText,
} from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import { inferLineupCompleteness } from '@/features/event-detail/utils/lineup-completeness';

function importRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'rec-1',
    importJobId: 'job-1',
    sourceId: 'source-ticket-io-protontheclub',
    externalId: 'https://proton-the-club.ticket.io/hyHJr2xd/',
    rawPayload: {},
    normalizedPayload: {
      title: 'DNB CONNECTION pres. SHOCKONE',
      startDate: '2026-07-31T23:00:00+02:00',
      artistNames: ['SHOCKONE'],
      rawSourceType: 'json_ld',
    },
    status: 'imported',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sprint 43.2 production finalization', () => {
  it('decodes jwt payload claims without verification', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ iat: 1_700_000_000, exp: 1_800_000_000, role: 'service_role' }),
    ).toString('base64url');
    const claims = decodeJwtPayloadUnsafe(`${header}.${payload}.sig`);
    expect(claims?.role).toBe('service_role');
    expect(claims?.iat).toBe(1_700_000_000);
  });

  it('detects jwt issued at future errors', () => {
    expect(isJwtIssuedAtFutureError('JWT issued at future')).toBe(true);
    expect(isJwtIssuedAtFutureError('PGRST303')).toBe(true);
  });

  it('measures local clock skew against remote Date header', async () => {
    const local = new Date('2026-07-31T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(local);
    const report = await measureClockSkewAgainstHttpDate(
      async () =>
        ({
          headers: { get: () => 'Thu, 31 Jul 2026 11:58:00 GMT' },
        }) as Response,
      'https://example.supabase.co',
    );
    expect(report.skewDirection).toBe('local_ahead');
    expect(report.skewMs).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('extracts SHOCKONE and DEXPHASE from titles', () => {
    expect(extractArtistsFromEventTitle('DNB CONNECTION pres. SHOCKONE')).toEqual(['SHOCKONE']);
    expect(extractArtistsFromEventTitle('FATALITY pres. DEXPHASE')).toEqual(['DEXPHASE']);
    expect(extractTitleDerivedArtistNames(importRecord())).toEqual(['SHOCKONE']);
  });

  it('creates title-inferred artists when no catalog match exists', async () => {
    const catalog = createTestMatchingCatalog({ artists: [] });
    const saved: string[] = [];
    const result = await resolveTitleLineupArtistIds({
      record: importRecord(),
      catalog,
      allArtists: [],
      saveArtist: async (artist) => {
        saved.push(artist.name);
        return artist;
      },
    });
    expect(result.artistIds).toHaveLength(1);
    expect(saved).toEqual(['SHOCKONE']);
    expect(result.completeness).toBe('partial');
    expect(result.source).toBe('title_inference');
  });

  it('reuses existing catalog artist without creating duplicates', async () => {
    const catalog = createTestMatchingCatalog({
      artists: [{ id: 'artist-shockone', name: 'SHOCKONE' }],
    });
    const result = await resolveTitleLineupArtistIds({
      record: importRecord(),
      catalog,
      allArtists: [{ id: 'artist-shockone', name: 'SHOCKONE', slug: 'shockone', genreIds: [], status: 'published', verificationStatus: 'verified', createdAt: '', updatedAt: '' }],
      saveArtist: async () => {
        throw new Error('should not create');
      },
    });
    expect(result.artistIds).toEqual(['artist-shockone']);
    expect(result.createdArtistIds).toEqual([]);
  });

  it('formats German Ticket.io overview prices for display', () => {
    expect(formatTicketPriceFromOverviewText('Tickets ab 12,00 Euro')).toBe('ab 12,00 €');
    expect(formatDisplayPriceText('Tickets ab 12,00 Euro')).toBe('ab 12,00 €');
    expect(formatDisplayPriceText('Tickets from 12.00 EUR')).toBe('ab 12,00 €');
  });

  it('marks SHOCKONE-style title artists as partial lineup', () => {
    expect(inferLineupCompleteness(
      { title: 'DNB CONNECTION pres. SHOCKONE' } as never,
      1,
    )).toBe('partial');
    expect(inferLineupCompleteness(
      { title: 'FATALITY pres. DEXPHASE' } as never,
      1,
    )).toBe('partial');
  });

  it('does not claim full lineup for single title-derived artist', () => {
    expect(inferLineupCompleteness(
      { title: 'DNB CONNECTION pres. SHOCKONE' } as never,
      1,
    )).not.toBe('full');
  });

  it('documents safe match threshold', () => {
    expect(TITLE_LINEUP_SAFE_MATCH_THRESHOLD).toBeGreaterThanOrEqual(95);
  });
});
