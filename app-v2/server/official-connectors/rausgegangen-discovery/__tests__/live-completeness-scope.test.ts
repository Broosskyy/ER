import { describe, expect, it } from 'vitest';
import { buildLiveRausgegangenScope, type LiveScopeRow } from '../live-completeness-scope';
import { STAGING_PROJECT_REF } from '../../../ingestion/sync/staging-guard';

function makeRow(overrides: Partial<LiveScopeRow> = {}): LiveScopeRow {
  return {
    eventId:'event-1',sourceId:'source-1',
    sourceUrl:'https://rausgegangen.de/events/test-rave-0/',title:'Test Rave',
    startsAt:'2026-12-01T20:00:00+00:00',endsAt:null,timezone:'Europe/Berlin',
    venueName:'Test Club',city:'Köln',organizerName:null,currentLineupCount:0,
    hasDescription:false,currentTicket:null,...overrides,
  };
}
const generatedAt='2026-10-18T15:00:00Z';
describe('Rausgegangen current scope (read only)', () => {
  it('flags unknown completeness, not imaginary zero ticket prices', () => {
    const { manifest,audit }=buildLiveRausgegangenScope([makeRow()],STAGING_PROJECT_REF,generatedAt);
    expect(manifest.events[0]).toMatchObject({
      sourceEventKey:'rausgegangen:test-rave-0',eventId:'event-1',sourceId:'source-1',
    });
    expect(audit.missingDescriptions).toBe(1);
    expect(audit.missingLineups).toBe(1);
    expect(audit.missingTicketRows).toBe(1);
    expect(audit.missingTicketPrices).toBe(0);
    expect(audit.missingOrganizers).toBe(1);
  });
  it('treats ambiguous status and absent price as verification gaps', () => {
    const {audit}=buildLiveRausgegangenScope([makeRow({
      hasDescription:true,currentLineupCount:2,organizerName:'Promoter',
      currentTicket:{ticketId:'t1',provider:'organizer_shop',
        ticketUrl:'https://tickets.example.com/e/1',priceFromMinor:null,currency:null,
        salesStatus:'availability_unverified',sortOrder:0},
    })],STAGING_PROJECT_REF,generatedAt);
    expect(audit.missingTicketRows).toBe(0);
    expect(audit.missingTicketPrices).toBe(1);
    expect(audit.unverifiedTicketStatuses).toBe(1);
    expect(audit.missingLineups).toBe(0);
  });
  it('refuses duplicate event IDs and source slugs', () => {
    expect(()=>buildLiveRausgegangenScope([makeRow(),makeRow({eventId:'event-2'})],STAGING_PROJECT_REF,generatedAt))
      .toThrow('live_scope_duplicate_binding');
  });
  it('fails closed for impostor URLs, empty results and production projects', () => {
    expect(()=>buildLiveRausgegangenScope([makeRow({sourceUrl:'https://fake.test/events/test-rave-0/'})],
      STAGING_PROJECT_REF,generatedAt)).toThrow('live_scope_non_rausgegangen_source');
    expect(()=>buildLiveRausgegangenScope([],STAGING_PROJECT_REF,generatedAt))
      .toThrow('live_scope_empty_or_unavailable');
    expect(()=>buildLiveRausgegangenScope([makeRow()],'production-ref',generatedAt))
      .toThrow('live_scope_wrong_project');
  });
  it('produces a stable chronological manifest', () => {
    const {manifest}=buildLiveRausgegangenScope([makeRow(),makeRow({
      eventId:'event-2',sourceId:'source-2',
      sourceUrl:'https://rausgegangen.de/events/test-rave-1/',
      startsAt:'2026-11-01T19:00:00+00:00',
    })],STAGING_PROJECT_REF,generatedAt);
    expect(manifest.events.map(x=>x.eventId)).toEqual(['event-2','event-1']);
  });
});
