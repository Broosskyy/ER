import * as cheerio from 'cheerio';
import {describe,expect,it} from 'vitest';
import {parseBootshausVenueBlock} from '../parse-venue';
import {extractArtistsContainerBlock,extractLineupContainerBlock} from '../parse-dom-sections';
import {validateEventCandidate} from '../../../ingestion/validation/validate-event-candidate';
import type {EventCandidate} from '../../../ingestion/types/event-candidate';

describe('international Bootshaus-promoted events',()=>{
  it('identifies Amsterdam four-digit postal format instead of guessing DE',()=>{
    const venue=parseBootshausVenueBlock('Koepelkerk<br>Kattengat 1, 1012 Amsterdam');
    expect(venue).toMatchObject({
      name:'Koepelkerk', city:'Amsterdam', countryCode:'NL',postalCode:'1012',
    });
  });
  it('still parses ordinary Cologne five-digit German venues',()=>{
    const venue=parseBootshausVenueBlock('Bootshaus<br>Auenweg 173, 51063 Köln');
    expect(venue).toMatchObject({
      name:'Bootshaus',city:'Köln',postalCode:'51063',countryCode:'DE',
    });
  });
  it('does not falsely assign DE when venue address has no identifiable country',()=>{
    expect(parseBootshausVenueBlock('Secret venue<br>Address to follow')?.countryCode)
      .toBeUndefined();
  });
  it('keeps adjacent HTML lineup artist elements separate',()=>{
    const $=cheerio.load('<section class="artists-container"><div>DJ HYPERDRIVE</div><div>EMILIJA</div><div>IN FURCHT</div></section>' +
      '<section class="lineup-container"><p>JOHANNES SCHUSTER</p><p>KLOFAMA</p></section>');
    expect(extractArtistsContainerBlock($)?.rawLines).toEqual(['DJ HYPERDRIVE','EMILIJA','IN FURCHT']);
    expect(extractLineupContainerBlock($)?.rawLines).toEqual(['JOHANNES SCHUSTER','KLOFAMA']);
  });
  it('requires a confirmed city on new official source candidates',()=>{
    const event:EventCandidate={
      origin:{kind:'official_connector',connectorId:'bootshaus-official',
        sourceEventKey:'nl-party',officialUrl:'https://bootshaus.tv/events/nl-party/',
        pageFingerprint:'fingerprint',fetchedAt:'2026-10-21T10:00:00Z',enrichmentGaps:[]},
      title:'Amsterdam party',startsAt:'2026-10-24T20:00:00+02:00',
      timezone:'Europe/Berlin',venue:{name:'Koepelkerk',countryCode:'NL'},
      lineup:[],genres:[],tickets:[],
    };
    const validation=validateEventCandidate(event);
    expect(validation.decision).toBe('review_required');
    expect(validation.reasons).toContain('venue_city_unverified');
  });
});
