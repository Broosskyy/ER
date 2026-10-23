import { describe, expect, it } from 'vitest';
import type { EventCandidate } from '../../types/event-candidate';
import { isRausgegangenNewEventSourceReady, isZakkNewEventSourceReady, isStadtgartenNewEventSourceReady, isEventServiceInsteadOfPerformance } from '../new-event-source-quality';

function candidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    origin: {kind:'official_connector',connectorId:'rausgegangen-discovery',
      sourceEventKey:'rg:abc',officialUrl:'https://rausgegangen.de/events/example-techno-1/',
      pageFingerprint:'fingerprint',fetchedAt:'2026-10-23T12:00:00Z'},
    title:'Example Techno Night',startsAt:'2026-11-30T22:00:00+01:00',
    timezone:'Europe/Berlin',description:'Confirmed electronic music night at the named venue in Cologne, with a published date.',
    venue:{name:'Club',city:'Köln',countryCode:'DE'},lineup:[],genres:[],tickets:[],
    ...overrides,
  };
}
const now=new Date('2026-10-23T12:00:00Z');

describe('Rausgegangen source-only publication fallback',()=>{
  it('allows fully qualified event details without ticket price, status or URL',()=>{
    expect(isRausgegangenNewEventSourceReady(candidate(),now)).toBe(true);
  });
  it('blocks generic source, missing description and missing venue city',()=>{
    const base=candidate();
    expect(isRausgegangenNewEventSourceReady(
      {...base,origin:{...base.origin,officialUrl:'https://rausgegangen.de/'}} as EventCandidate,now)).toBe(false);
    expect(isRausgegangenNewEventSourceReady(candidate({description:''}),now)).toBe(false);
    expect(isRausgegangenNewEventSourceReady(
      candidate({venue:{name:'Club',city:'',countryCode:'DE'}}),now)).toBe(false);
  });
  it('never publishes a past event',()=>{
    expect(isRausgegangenNewEventSourceReady(candidate({startsAt:'2026-09-01T22:00:00Z'}),now)).toBe(false);
  });
});

describe('zakk official new-event fallback',()=>{
  const zakk={
    ...candidate(),
    origin:{kind:'official_connector' as const, connectorId:'zakk-official',
      sourceEventKey:'12345', officialUrl:'https://zakk.de/event-detail?event=12345',
      pageFingerprint:'valid',fetchedAt:'2026-10-23T12:00:00Z'},
  };
  it('permits a properly sourced future event with no verified checkout',()=>{
    expect(isZakkNewEventSourceReady(zakk,now)).toBe(true);
  });
  it('blocks generic and non-event-specific source URLs',()=>{
    expect(isZakkNewEventSourceReady({...zakk,origin:{
      ...zakk.origin,officialUrl:'https://zakk.de/programm/party/' }},now)).toBe(false);
  });
});

describe('Stadtgarten official electronic-source fallback',()=>{
  const event={
    ...candidate(),
    origin:{kind:'official_connector' as const,connectorId:'stadtgarten-official',
      sourceEventKey:'12001',officialUrl:'https://www.stadtgarten.de/programm/techno-night-12001/',
      pageFingerprint:'fp',fetchedAt:'2026-10-23T12:00:00Z'},
  };
  it('allows only detailed future listings with venue and source',()=>{
    expect(isStadtgartenNewEventSourceReady(event,now)).toBe(true);
    expect(isStadtgartenNewEventSourceReady({...event,description:''},now)).toBe(false);
    expect(isStadtgartenNewEventSourceReady({...event,origin:{
      ...event.origin,officialUrl:'https://www.stadtgarten.de/programm/'}},now)).toBe(false);
  });
});

describe('transport listings are not rave events',()=>{
  it('quarantines bus and shuttle transfer pages even with hardcore keywords',()=>{
    const service=candidate({title:'Bus zur Pandemonium 2026 (Gabber und Early Hardcore)'});
    expect(isEventServiceInsteadOfPerformance(service.title)).toBe(true);
    expect(isRausgegangenNewEventSourceReady(service,now)).toBe(false);
  });
  it('preserves genuine music nights even when their descriptions discuss travel',()=>{
    const event=candidate({title:'Bus Stop Rave with the DJs',
      description:'Ticket includes additional bus-shuttle options to the venue'});
    expect(isEventServiceInsteadOfPerformance(event.title)).toBe(false);
    expect(isRausgegangenNewEventSourceReady(event,now)).toBe(true);
  });
});
