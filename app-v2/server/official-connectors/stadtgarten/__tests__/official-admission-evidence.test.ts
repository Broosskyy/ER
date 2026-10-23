import { describe, expect, it } from 'vitest';
import type { VerifiedTicketCompleteResult } from '../../ticket-evidence/ticket-audit-metrics';
import { planTicketEvidencePersistence } from '../../ticket-evidence/ticket-persistence-planner';
import { addStadtgartenSourcePriceFallback, readStadtgartenOfficialAdmission } from '../official-admission-evidence';

const URL = 'https://www.stadtgarten.de/programm/jaki-presents-spoeki-auflinks-11987/';
const TIME = '2026-11-27T22:30:00+01:00';
const observedAt = '2026-10-23T12:00:00Z';
const base: VerifiedTicketCompleteResult = {
  sourceEventKey:'11987',officialUrl:URL,title:'JAKI presents: Spöki & auflinks',
  startsAt:TIME,venueName:'Stadtgarten — JAKI',
  discoveredLinks:[],rejectedCandidates:[],
  identityResult:'ticket_identity_unverifiable',identityReasons:[],
  classification:'ticket_evidence_missing',verifiedTicketComplete:false,
};
function page(text:string): string {
  return '<html><body><div class="asidetext"><p>'+text+'</p></div></body></html>';
}
const bindings=[{
  eventId:'event-1',sourceId:'source-1',officialUrl:URL,contentHash:'fp',
  rawPayload:{},title:base.title,
}];

describe('event-specific official Stadtgarten admission evidence',()=>{
  it('records the official 12€ box office without inventing an online purchase URL',()=>{
    const html=page('Fr, 27.11.2026 Late Night House, Disco JAKI 12 € Abendkasse nur Barzahlung');
    const evidence=addStadtgartenSourcePriceFallback(base,html,observedAt);
    const [plan]=planTicketEvidencePersistence([evidence],{
      officialBindings:bindings,existingTickets:[],existingTicketSources:[],
    });
    expect(readStadtgartenOfficialAdmission(html)).toMatchObject({priceMinor:1200,kind:'box_office'});
    expect(plan?.ticketOperation).toBe('insert');
    expect(plan?.plannedTicketRow?.priceFromMinor).toBe(1200);
    expect(plan?.plannedTicketRow?.ticketUrl).toBeUndefined();
    expect(plan?.consumerProjection.hasActivePurchaseCta).toBe(false);
    expect(evidence.priceEvidence?.sourceUrl).toBe(URL);
  });
  it('keeps an official 23€ presale quote with an unverified provider link non-bookable',()=>{
    const html=page('Sa, 24.10.2026 23 € Vorverkauf 25 € Abendkasse');
    const evidence=addStadtgartenSourcePriceFallback(base,html,observedAt);
    const [plan]=planTicketEvidencePersistence([evidence],{
      officialBindings:bindings,existingTickets:[],existingTicketSources:[],
    });
    expect(plan?.plannedTicketRow?.priceFromMinor).toBe(2300);
    expect(plan?.plannedTicketRow?.salesStatus).toBe('availability_unverified');
    expect(plan?.plannedTicketRow?.ticketUrl).toBeUndefined();
    expect(plan?.consumerProjection.hasActivePurchaseCta).toBe(false);
  });
  it('never overwrites a prior verified checkout link with a source-only price',()=>{
    const evidence=addStadtgartenSourcePriceFallback(base,page('12 € Abendkasse'),observedAt);
    const [plan]=planTicketEvidencePersistence([evidence],{
      officialBindings:bindings,
      existingTickets:[{
        ticketId:'ticket-1',eventId:'event-1',sortOrder:0,provider:'ticket_io',
        ticketUrl:'https://stadtgarten.ticket.io/abc123/',currency:'EUR',
        priceFromMinor:1400,salesStatus:'available',
      }],
      existingTicketSources:[],
    });
    expect(plan?.ticketOperation).toBe('noop');
  });
  it('ignores price labels outside the event facts, and rejects sold-out or generic prices',()=>{
    expect(readStadtgartenOfficialAdmission('<body>12 € Abendkasse</body>')).toBeUndefined();
    expect(readStadtgartenOfficialAdmission(page('Ausverkauft! 12 € Abendkasse'))).toBeUndefined();
    expect(readStadtgartenOfficialAdmission(page('12 € Getränkepaket'))).toBeUndefined();
  });
  it('does not override an actually verified provider ticket',()=>{
    const evidence=addStadtgartenSourcePriceFallback({
      ...base,verifiedTicketComplete:true,canonicalTicketUrl:'https://stadtgarten.ticket.io/abc123/',
    },page('12 € Abendkasse'),observedAt);
    expect(evidence.priceEvidence).toBeUndefined();
  });
});