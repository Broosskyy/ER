import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAffenkaefigLineupFromHtml } from '@/features/aggregation/connectors/website/affenkaefig-detail-lineup';
import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import { parseJsonLdEvent, collectJsonLdNodes, extractJsonLdBlocks } from '@/features/import/adapters/parsers/json-ld-parser';
import { pickBetterArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { isPlaceholderOnlyLineup } from '@/features/import/services/import-lineup-projection-repair';

const SOMMERFEST_TK_FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-sommerfest-detail.html',
);
const SOMMERFEST_AF_FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/website/fixtures/affenkaefig-sommerfest-lineup.html',
);

const EXPECTED_LINEUP = [
  'ASL∅',
  'ANNX',
  'BLACK ZUSHI',
  'BOUNCE MC',
  'HOTBOI2300',
  'HYPNOTIZED',
  'ICJ',
  'MAURO',
  'STIMULATE',
  'THE M∅VEMENT',
  'TOMMY LIBERA',
  'TURBO TIMOS',
  'JULEZ BRIXTON',
  'SEBI LIEMEN',
];

describe('single-issue-001 Sommerfest lineup', () => {
  it('extracts 14-artist br-separated Ticket Kings lineup', () => {
    const html = readFileSync(SOMMERFEST_TK_FIXTURE, 'utf8');
    const parsed = parseTicketKingsDetailHtml(html);

    expect(parsed.artistNames).toEqual(EXPECTED_LINEUP);
    expect(parsed.lineupEntries).toHaveLength(14);
    expect(parsed.genreNames).toEqual(expect.arrayContaining(['Techno', 'Bounce', 'Hardtechno']));
    expect(parsed.floorCount).toBe(3);
    expect(parsed.venueEnvironment).toBe('hybrid');
  });

  it('extracts Affenkäfig ecm-event-lineup grid from Sommerfest detail HTML', () => {
    const html = readFileSync(SOMMERFEST_AF_FIXTURE, 'utf8');
    const artists = parseAffenkaefigLineupFromHtml(html);
    expect(artists).toEqual(EXPECTED_LINEUP);
  });

  it('rejects JSON-LD Organization performers globally', () => {
    const node = {
      '@type': 'Event',
      name: 'Test',
      startDate: '2026-08-08T17:00:00+02:00',
      performer: { '@type': 'Organization', name: 'Organization' },
    };
    const parsed = parseJsonLdEvent(node);
    expect(parsed.fields.artistNames).toBeUndefined();
  });

  it('prefers richer dual-origin lineup merge', () => {
    const affenkaefig = EXPECTED_LINEUP.slice(0, 10);
    const ticketKings = EXPECTED_LINEUP;
    const merged = pickBetterArtistNames(affenkaefig, ticketKings);
    expect(merged).toEqual(EXPECTED_LINEUP);
  });

  it('detects placeholder-only canonical lineup for repair', () => {
    const artistsById = new Map([
      ['artist-title-organization-dq95oq', { name: 'Organization' }],
    ]);
    expect(isPlaceholderOnlyLineup(['artist-title-organization-dq95oq'], artistsById)).toBe(true);
  });

  it('does not treat JSON-LD graph Organization node as event performer list', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Organization',
        },
        {
          '@type': 'Event',
          name: 'Sommerfest',
          startDate: '2026-08-08T17:00:00+02:00',
          performer: { '@type': 'Organization', name: 'Organization' },
        },
      ],
    })}</script>`;

    const blocks = extractJsonLdBlocks(html);
    const nodes = blocks.flatMap((block) => collectJsonLdNodes(block));
    const eventNode = nodes.find((node) => String(node['@type']).includes('Event'));
    expect(eventNode).toBeTruthy();
    const parsed = parseJsonLdEvent(eventNode!);
    expect(parsed.fields.artistNames).toBeUndefined();
  });
});
