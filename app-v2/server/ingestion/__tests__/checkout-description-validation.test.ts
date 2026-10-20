import {describe,expect,it} from 'vitest';
import {validateEventCandidate} from '../validation/validate-event-candidate';
import type {EventCandidate} from '../types/event-candidate';

const base:EventCandidate={
  origin:{kind:'official_connector',connectorId:'affenkaefig-official',
    sourceEventKey:'elfter',officialUrl:'https://affenkaefig.info/event/elfter/',
    pageFingerprint:'abc',fetchedAt:'2026-10-20T10:00:00Z',enrichmentGaps:[]},
  title:'Elfter Elfter Karneval',startsAt:'2026-11-11T18:00:00+01:00',
  timezone:'Europe/Berlin',venue:{name:'Elektroküche',city:'Köln'},
  lineup:[],genres:[],tickets:[],
};
describe('cross-source checkout description safety',()=>{
  it('rejects embedded checkout HTML before it can reach the public events table',()=>{
    const description='N8 Manager Events Ticketbörse Bestellerdaten Deine Angaben Bitte wähle mindestens ein Ticket '.repeat(40);
    const decision=validateEventCandidate({...base,description});
    expect(decision.decision).toBe('rejected');
    expect(decision.reasons).toContain('checkout_html_in_description');
  });
  it('allows a legitimate longer editorial description without checkout markers',()=>{
    const decision=validateEventCandidate({...base,description:'Große Techno-Party mit Live-Sets. '.repeat(65)});
    expect(decision.reasons).not.toContain('checkout_html_in_description');
  });
});
