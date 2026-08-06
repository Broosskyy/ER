import { describe, expect, it } from 'vitest';

import { classifyElectronicMusicRelevance } from '@/features/aggregation/connectors/ticket-platform/electronic-music-relevance';
import { filterElectronicMusicEvents } from '@/features/aggregation/connectors/ticket-platform/electronic-music-scope-filter';
import type { ParsedTicketPlatformEvent } from '@/features/aggregation/connectors/ticket-platform/types';
import { qualifyTicketIoShop } from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-qualification';
import type { TicketIoProbeResult } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';
import { listTicketIoSeedSlugs } from '@/features/ticket-platform-discovery/discovery/ticket-io-seed-urls';

function createEvent(overrides: Partial<ParsedTicketPlatformEvent> = {}): ParsedTicketPlatformEvent {
  return {
    externalId: 'https://protontheclub.ticket.io/test/',
    title: 'Hard Techno Night',
    startDate: '2026-08-01T22:00:00+02:00',
    timezone: 'Europe/Berlin',
    ticketUrl: 'https://protontheclub.ticket.io/test/',
    eventUrl: 'https://protontheclub.ticket.io/test/',
    platform: 'ticket_io',
    shopSlug: 'protontheclub',
    venueName: 'Proton The Club',
    ...overrides,
  };
}

describe('Phase 4 electronic relevance', () => {
  it('classifies known clubs as relevant', () => {
    expect(classifyElectronicMusicRelevance(createEvent()).relevance).toBe('relevant');
  });

  it('classifies comedy as irrelevant', () => {
    expect(
      classifyElectronicMusicRelevance(
        createEvent({ title: 'Stand-up Comedy Night', venueName: 'City Hall' }),
      ).relevance,
    ).toBe('irrelevant');
  });

  it('classifies weak hints as uncertain and keeps them importable', () => {
    const { events, stats } = filterElectronicMusicEvents([
      createEvent({
        title: 'Warehouse Party',
        venueName: 'Unknown Hall ZZZ',
        organizerName: undefined,
      }),
    ]);
    expect(stats.uncertain).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.electronicRelevance).toBe('uncertain');
  });

  it('provides curated seed slugs for discovery', () => {
    const slugs = listTicketIoSeedSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(8);
    expect(slugs).toContain('technodampfer');
    expect(slugs).toContain('proton-the-club');
    expect(slugs).not.toContain('bootshaus-club');
  });

  it('qualifies shops with enough relevant events as auto_publish candidates', () => {
    const probe: TicketIoProbeResult = {
      shopSlug: 'technodampfer',
      listUrl: 'https://technodampfer.ticket.io/',
      valid: true,
      eventCount: 6,
      paginationDetected: false,
      requiredFieldsValid: true,
      preview: [],
      warnings: [],
      scopeStats: { discovered: 8, accepted: 6, rejected: 2, uncertain: 0, rejectionReasons: {} },
    };
    const qualification = qualifyTicketIoShop(probe);
    expect(qualification.tier).toBe('relevant');
    expect(qualification.recommendedPublishBehavior).toBe('auto_publish');
  });
});
