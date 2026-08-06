import { describe, expect, it } from 'vitest';

import {
  classifyOutboundTicketLink,
  extractOutboundTicketLinksFromText,
} from '@/features/aggregation/domain/cross-source-ticket-discovery';
import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';
import {
  extractLineupNamesFromDescriptionText,
  extractLineupSectionKey,
  isRejectedLineupToken,
} from '@/features/aggregation/domain/lineup-text-parser';
import {
  extractRunningOrderFromDescriptionText,
  extractTimetableFromDescriptionText,
} from '@/features/aggregation/domain/textual-timetable-parser';
import { enrichWebsiteEventFromTextualSources } from '@/features/aggregation/connectors/website/website-textual-enrichment';
import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';

const baseEvent = (): RawWebsiteEvent => ({
  sourceUrl: 'https://example.com/events/1',
  externalId: 'https://example.com/events/1',
  title: 'Sample Event',
  extractionStrategy: 'event_detail_page',
  extractionConfidence: 0.8,
  fieldEvidence: [],
  warnings: [],
});

describe('phase 4.6.6 textual parsers', () => {
  it('extracts lineup section variants and rejects venue noise', () => {
    const description =
      'Artists: ANNA B2B REINIER ZONN, KI/KI Running Order: 22:00 ANNA 23:30 KI/KI Location: Bootshaus';
    const names = extractLineupNamesFromDescriptionText(description);
    expect(names).toEqual(expect.arrayContaining(['ANNA', 'REINIER ZONN', 'KI/KI']));
    expect(names?.some((name) => /location/i.test(name))).toBe(false);
    expect(extractLineupSectionKey(description)).toBe('artists');
  });

  it('rejects sponsor and edition tokens', () => {
    expect(isRejectedLineupToken('Presented by')).toBe(true);
    expect(isRejectedLineupToken('xxx EDITION')).toBe(true);
    expect(extractLineupNamesFromDescriptionText('Line Up: xxx EDITION')).toBeUndefined();
  });

  it('extracts running order without requiring times', () => {
    const description = `Running Order:
Stage 1: ANNA, KI/KI
Stage 2: DAXSON`;
    const runningOrder = extractRunningOrderFromDescriptionText(description);
    expect(runningOrder?.length).toBeGreaterThanOrEqual(2);
    expect(runningOrder?.[0]?.stageOrFloor).toBe('1');
  });

  it('extracts timetable slots when times are present', () => {
    const description = `Timetable:
22:00 - 23:00 ANNA B2B REINIER ZONN
23:30 KI/KI`;
    const timetable = extractTimetableFromDescriptionText(description);
    expect(timetable?.[0]?.startTime).toBe('22:00');
    expect(timetable?.[0]?.displayName).toMatch(/ANNA/i);
  });

  it('extracts structured attributes from description text', () => {
    const description =
      'Open Air Festival on 3 floors. Mindestalter 18+. Doors open at 23:00.';
    const parsed = extractAttributesFromDescriptionText(description);
    expect(parsed.attributes.some((a) => a.key === 'open_air')).toBe(true);
    expect(parsed.floorCount).toBe(3);
    expect(parsed.minimumAge).toBe('18+');
    expect(parsed.doorsOpenAt).toBe('23:00');
  });

  it('classifies outbound ticket links for cross-source discovery', () => {
    const ticketIo = classifyOutboundTicketLink(
      'https://bootshaus.ticket.io/events/bootshaus-on-a-ship/',
    );
    expect(ticketIo.class).toBe('ticket_io_event');
    expect(ticketIo.eventSlug).toBeTruthy();

    const ticketKings = classifyOutboundTicketLink(
      'https://ticketkings.de/event/vision-ekstase-123',
    );
    expect(ticketKings.class).toBe('ticket_kings_event');

    const links = extractOutboundTicketLinksFromText(
      'Tickets: https://bootshaus.ticket.io/events/bootshaus-on-a-ship/ and https://bootshaus.tv/events',
    );
    expect(links[0]?.class).toBe('ticket_io_event');
  });

  it('enriches website events from description textual sources', () => {
    const event = enrichWebsiteEventFromTextualSources({
      ...baseEvent(),
      rawDescription:
        'Line Up: ANNA B2B REINIER ZONN Tickets: https://bootshaus.ticket.io/events/bootshaus-on-a-ship/',
    });
    expect(event.rawArtists?.length).toBeGreaterThan(0);
    expect(event.rawTicketLinks?.[0]).toMatch(/ticket\.io/);
    expect(event.warnings).toContain('textual_lineup_from_description');
    expect(event.warnings.some((w) => w.startsWith('cross_source_ticket_link'))).toBe(true);
  });
});
