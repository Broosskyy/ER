import { describe, expect, it } from 'vitest';

import { CONNECTOR_NORMALIZED_FIELD_KEYS } from '@/features/aggregation/domain/connector-normalized-contract';
import { FIELD_FALLBACK_CHAINS, resolveImportOriginChannel } from '@/features/events/domain/field-fallback-priority';
import { classifyTicketUrl } from '@/features/events/domain/ticket-url-quality';
import {
  eventHasSourceDefaultVenueMisapplied,
  readSourceDefaultVenueContext,
} from '@/features/import/services/source-default-venue-repair';
import {
  eventNeedsTicketPlatformFieldRepair,
  isTicketPlatformSourceContext,
} from '@/features/import/services/ticket-platform-field-repair';

describe('generic source architecture (Phase 4.6.6 §2B)', () => {
  it('defines a source-agnostic connector normalized contract', () => {
    expect(CONNECTOR_NORMALIZED_FIELD_KEYS).toContain('lineup');
    expect(CONNECTOR_NORMALIZED_FIELD_KEYS).toContain('ticketPhases');
    expect(CONNECTOR_NORMALIZED_FIELD_KEYS).toContain('provenance');
  });

  it('uses generic ticket platform origins in field fallback chains', () => {
    const lineup = FIELD_FALLBACK_CHAINS.find((chain) => chain.field === 'lineup');
    expect(lineup?.priority).toContain('ticket_platform_detail');
    expect(lineup?.priority.some((origin) => origin.includes('ticket_io'))).toBe(false);
  });

  it('resolves ticket platform origins without provider-specific branches', () => {
    expect(
      resolveImportOriginChannel({
        connectorKey: 'ticket_platform',
        platform: 'ticket_io',
        detailFetched: true,
      }),
    ).toBe('ticket_platform_detail');
    expect(
      resolveImportOriginChannel({
        connectorKey: 'ticket_platform',
        platform: 'ticket_king',
        detailFetched: false,
      }),
    ).toBe('ticket_platform_list');
  });

  it('classifies club website event pages generically, not per-provider hosts', () => {
    const bootshausInfo = classifyTicketUrl('https://bootshaus.tv/events/play-open-air');
    expect(bootshausInfo.class).toBe('event_info_page');

    const affenkaefigInfo = classifyTicketUrl('https://affenkaefig.info/events/sample');
    expect(affenkaefigInfo.class).toBe('event_info_page');
  });

  it('detects source default venue misapplication from field defaults metadata', () => {
    const context = readSourceDefaultVenueContext({
      fieldDefaults: { venueId: 'venue-club-a', venueName: 'Club A', cityName: 'Köln' },
    });
    expect(
      eventHasSourceDefaultVenueMisapplied(
        {
          title: '122 pres. ARTIST @ Palma de Mallorca (ES)',
          venueId: 'venue-club-a',
          venueName: 'Club A',
          venueCity: 'Köln',
        } as never,
        context,
      ),
    ).toBe(true);
  });

  it('repairs ticket platform fields by connector type, not source id lists', () => {
    expect(
      isTicketPlatformSourceContext({ connectorKey: 'ticket_platform', platform: 'ticket_io' }),
    ).toBe(true);
    expect(
      eventNeedsTicketPlatformFieldRepair(
        { description: 'n/a', priceText: '' } as never,
        { connectorKey: 'ticket_platform', platform: 'ticket_king' },
      ),
    ).toBe(true);
    expect(
      eventNeedsTicketPlatformFieldRepair(
        { description: 'n/a', priceText: '' } as never,
        { connectorKey: 'club_website' },
      ),
    ).toBe(false);
  });
});
