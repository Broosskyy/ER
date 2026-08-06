import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import { parseTicketKingsEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { parseTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import { mergeDetailWithPreviousSnapshot } from '@/features/aggregation/domain/detail-snapshot';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';

const DETAIL_FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-event-detail.html',
);

describe('phase463 detail extraction', () => {
  it('rejects Organization as lineup artist', () => {
    expect(isLineupPlaceholderArtist('Organization')).toBe(true);
    expect(isLineupPlaceholderArtist('Line Up')).toBe(true);
  });

  it('extracts Ticket Kings HTML lineup with B2B/F2F roles', () => {
    const html = readFileSync(DETAIL_FIXTURE_PATH, 'utf8');
    const parsed = parseTicketKingsDetailHtml(html);

    expect(parsed.lineupEntries?.length).toBeGreaterThanOrEqual(9);
    expect(parsed.artistNames).not.toContain('Organization');
    expect(parsed.lineupEntries?.some((entry) => entry.isB2b)).toBe(true);
    expect(parsed.lineupEntries?.some((entry) => entry.isF2f)).toBe(true);
    expect(parsed.checkoutProviderId).toBe('24');
  });

  it('maps Ticket Kings detail page to event with lineup', () => {
    const html = readFileSync(DETAIL_FIXTURE_PATH, 'utf8');
    const event = parseTicketKingsEventDetailHtml(html, {
      platform: 'ticket_king',
      shopSlug: 'ticketkings',
      listUrl: 'https://ticketkings.de/all-events/',
      timezone: 'Europe/Berlin',
    });

    expect(event?.lineupEntries?.length).toBeGreaterThanOrEqual(9);
    expect(event?.artistNames?.length).toBeGreaterThanOrEqual(9);
    expect(event?.venueName).toBe('Essigfabrik');
  });

  it('preserves prior snapshot when Ticket.io detail fetch is blocked', () => {
    const previous = {
      externalEventId: 'https://shop.ticket.io/event/test/',
      url: 'https://shop.ticket.io/event/test/',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      httpOutcome: 'success' as const,
      parserVersion: 'ticket-io-detail-v1',
      extractionWarnings: [],
      fieldCoverage: ['lineupEntries'],
      normalizedPayload: {
        artistNames: ['SHOCKONE', 'SICKBOY'],
        lineupEntries: [{ displayName: 'SHOCKONE', source: 'html_lineup', confidence: 0.95 }],
      },
    };

    const blockedCurrent = { artistNames: [], lineupEntries: [] };
    const merged = mergeDetailWithPreviousSnapshot(blockedCurrent, previous, true);

    expect(merged.artistNames).toEqual(['SHOCKONE', 'SICKBOY']);
    expect(merged.lineupEntries).toHaveLength(1);
  });

  it('does not treat blocked Ticket.io parse as empty enrichment for adapter merge', () => {
    const blocked = parseTicketIoDetailHtml('<html>x-waitio-location: pow</html>');
    expect(blocked.blockedByPow).toBe(true);
    expect(blocked.lineupEntries).toBeUndefined();
  });

  it('extracts genres and floor hints from labeled Ticket Kings HTML', () => {
    const html = `
      <p><strong>Genre</strong>: Techno, Bounce, Hardtechno</p>
      <p>Freut euch auf 3 Floors und Open-Air</p>
    `;
    const parsed = parseTicketKingsDetailHtml(html);
    expect(parsed.genreNames).toEqual(expect.arrayContaining(['Techno', 'Bounce', 'Hardtechno']));
    expect(parsed.floorCount).toBe(3);
  });
});
