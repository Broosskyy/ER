import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { collectTicketIoDetailSlugs } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-fetch';
import { withTicketIoEffectiveLimits } from '@/features/aggregation/connectors/ticket-platform/ticket-io-effective-config';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';

const FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);

describe('ticket.io detail slug discovery', () => {
  it('collects slugs from list rows and JSON-LD', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const slugs = collectTicketIoDetailSlugs(html, 'https://bootshaus-club.ticket.io/');
    expect(slugs).toContain('wUc3uQrR');
    expect(slugs).toContain('uSXeJhHU');
    expect(slugs.length).toBeGreaterThan(10);
  });
});

describe('ticket.io effective platform limits', () => {
  it('applies default maxDetailPages when missing from stored config', () => {
    const resolved = withTicketIoEffectiveLimits({
      platform: 'ticket_io',
      shopSlug: 'lehmannclub',
      limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
    });
    expect(resolved.limits?.maxDetailPages).toBe(15);
  });

  it('preserves explicit positive maxDetailPages', () => {
    const resolved = withTicketIoEffectiveLimits({
      platform: 'ticket_io',
      shopSlug: 'lehmannclub',
      limits: { maxDetailPages: 5 },
    });
    expect(resolved.limits?.maxDetailPages).toBe(5);
  });
});

describe('ticket.io invalid lineup regression', () => {
  it('rejects organizer credit fragments starting with by', () => {
    expect(isLineupPlaceholderArtist('by BOOTSHAUS')).toBe(true);
    expect(isLineupPlaceholderArtist('by Bootshaus!')).toBe(true);
  });

  it('does not infer artists from pres by organizer titles', () => {
    expect(extractArtistsFromEventTitle('DEBORAH DE LUCA pres by Bootshaus')).toBeUndefined();
    expect(extractArtistsFromEventTitle('R3HAB pres. by BOOTSHAUS')).toBeUndefined();
  });
});
