import { describe,expect,it } from 'vitest';
import { auditPublicTickets,reviewPublicTicket,type PublicTicketAuditRow }
  from '../daily-public-ticket-audit';

function ticket(override: Partial<PublicTicketAuditRow> = {}): PublicTicketAuditRow {
  return {eventId:'event-1',title:'Party',startsAt:'2026-11-12T22:00:00Z',
    ticketId:'ticket-1', provider:'ticket_io',
    priceMinor:2790,currency:'EUR',ticketUrl:'https://provider.example/e/a',
    salesStatus:'available', ...override};
}
describe('daily public ticket audit',()=>{
  it('flags explicit purchase links for per-event provider review',()=>{
    expect(reviewPublicTicket(ticket())).toContain('ticket_link_requires_source_verification');
  });
  it('does not treat verified conditional free or door only as broken prices',()=>{
    for(const status of ['free_until_midnight','door_only','free_entry']){
      const r=reviewPublicTicket(ticket({salesStatus:status,
        priceMinor:status==='free_entry'?0:null,ticketUrl:null}));
      expect(r).toEqual([]);
    }
  });
  it('flags malformed zero price and unknown providers',()=>{
    expect(reviewPublicTicket(ticket({priceMinor:0,provider:'unknown'})))
      .toEqual(expect.arrayContaining(['unknown_ticket_provider','unqualified_zero_price']));
  });
  it('never treats a missing ticket row as free or sold out',()=>{
    const report=auditPublicTickets([ticket({ticketId:null,priceMinor:null,ticketUrl:null})]);
    expect(report.countsByConcern.missing_ticket_record).toBe(1);
    expect(report.knownFullFree).toBe(0);
  });
  it('flags 0-price raw rows outside the explicit free-entry status',()=>{
    const concerns=reviewPublicTicket(ticket({priceMinor:0,salesStatus:'available'}));
    expect(concerns).toContain('unqualified_zero_price');
  });
  it('does not flag documented EUR 0 registration as an unqualified free entry',()=>{
    const concerns=reviewPublicTicket(ticket({
      priceMinor:0,currency:'EUR',salesStatus:'registration_only',
      ticketUrl:'https://bootshaus-club.ticket.io/verified-event/',
    }));
    expect(concerns).not.toContain('unqualified_zero_price');
  });
  it('flags missing checkout URLs for available, on_sale and low_availability',()=>{
    for(const salesStatus of ['available','on_sale','low_availability']){
      const concerns=reviewPublicTicket(ticket({salesStatus,ticketUrl:null}));
      expect(concerns).toContain('available_without_link_or_admission_context');
    }
  });
  it('puts real data gaps before routine external ticket re-verification',()=>{
    const report=auditPublicTickets([
      ticket({eventId:'e1',ticketId:null,ticketUrl:null}),
      ticket({eventId:'e2',ticketUrl:'https://provider.example/e/a'}),
    ]);
    expect(report.actionNeededCount).toBe(1);
    expect(report.actionNeeded[0]?.eventId).toBe('e1');
    expect(report.routineVerificationCount).toBe(1);
  });
  it('marks available-without-link as separate from proof of sale ending',()=>{
    const concerns=reviewPublicTicket(ticket({priceMinor:3500,ticketUrl:null}));
    expect(concerns).toContain('available_without_link_or_admission_context');
  });
});
