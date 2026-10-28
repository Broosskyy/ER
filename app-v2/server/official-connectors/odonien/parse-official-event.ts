import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { applyTimeToIsoDate } from '../stadtgarten/parse-datetime';
import { extractExplicitGenresFromPublishedText } from '../shared/published-genre-evidence';
import type { OfficialEventEvidence } from '../types';

export const ODONIEN_CONNECTOR_ID = 'odonien-club-official';
export const ODONIEN_LIST_URL = 'https://odonien.de/club';
const DETAIL_PATH = /^\/veranstaltungen\/([a-z0-9-]+)\/?$/i;

export function canonicalizeOdonienUrl(input:string,base=ODONIEN_LIST_URL):string|null {
 try {
  const u=new URL(input,base);
  if(u.protocol!=='https:' || !['odonien.de','www.odonien.de'].includes(u.hostname) ||
     u.username || u.password || (u.pathname!=='/club' && u.pathname!=='/club/' && !DETAIL_PATH.test(u.pathname))) return null;
  return u.pathname==='/club'||u.pathname==='/club/'?ODONIEN_LIST_URL:
    'https://odonien.de'+u.pathname.replace(/\/?$/,'');
 } catch { return null; }
}
export function isOdonienEventUrl(raw:string):boolean {
 const canonical=canonicalizeOdonienUrl(raw);
 return !!canonical && DETAIL_PATH.test(new URL(canonical).pathname);
}
export function discoverOdonienClubEventUrls(html:string):string[] {
 const $=cheerio.load(html);
 // Only URLs in the explicitly club-scoped calendar. The cultural calendar
 // (concerts, workshops, art exhibitions) is not an eligible source.
 const container=$('main').length ? $('main') : $('body');
 const urls=new Set<string>();
 container.find('a[href]').each((_i,node)=>{
   const canonical=canonicalizeOdonienUrl($(node).attr('href')||'');
   if(canonical&&isOdonienEventUrl(canonical))urls.add(canonical);
 });
 return [...urls];
}
const clean=(value:string)=>value.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
function eventText($:cheerio.CheerioAPI):string {
 const root=$('main').first().length?$('main').first():$('body');
 const html=root.html()||'';
 // Retain spaces separating blocks without including injected HTML/script.
 const spaced=html.replace(/<\/(?:p|h[1-6]|div|li|section)>/gi,' ')
   .replace(/<br\s*\/?>/gi,' ');
 return clean(cheerio.load('<section>'+spaced+'</section>')('section').text());
}
function findLocalStart(text:string):{startsAt:string;ending:number}|null {
 // Only a date close to the event heading, not a footer/newsletter date.
 const prefix=text.slice(0,1000);
 const m=/\b(\d{2})\.(\d{2})\.(20\d{2})\b/.exec(prefix);
 if(!m) return null;
 const following=prefix.slice(m.index+m[0].length,m.index+m[0].length+115);
 const time=/\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:Uhr)?\b/i.exec(following);
 if(!time) return null;
 const midnight=m[3]+'-'+m[2]+'-'+m[1]+'T00:00:00+01:00';
 const startsAt=applyTimeToIsoDate(midnight,Number(time[1]),Number(time[2]));
 if(!startsAt)return null;
 return {startsAt,ending:m.index+m[0].length+time.index+time[0].length};
}
export function parseOdonienClubDetail(
 html:string,url:string,fetchedAt:string,
):OfficialEventEvidence|null {
 const canonical=canonicalizeOdonienUrl(url);
 if(!canonical||!isOdonienEventUrl(canonical))return null;
 const $=cheerio.load(html);
 $('script,style,noscript,nav,footer').remove();
 const headline=$('main h1').toArray().map(el=>clean($(el).text()))
   .find(t=>t.length>=5&&t.length<=180&&!/^(?:odonien|club|kultur|events|veranstaltungen)$/i.test(t));
 const fallback=$('h1').toArray().map(el=>clean($(el).text()))
   .find(t=>t.length>=5&&t.length<=180&&!/^(?:odonien|club|kultur|events|veranstaltungen)$/i.test(t));
 const title=headline||fallback;
 if(!title)return null;
 const text=eventText($);
 if(!text.includes(title))return null;
 const date=findLocalStart(text);
 if(!date)return null;
 let section=text.slice(date.ending).replace(/^\s*(?:Uhr\s*)?(?:Tickets?\s*)?/i,'').trim();
 section=section.split(/\b(?:Club Care Odonien|NO PHONE CLUB|FAQ|Newsletter)\b/i)[0]?.trim()||'';
 // Keep event-specific descriptions, named floor lineups and explicitly
 // published genre labels. Never include ticket-product/door metadata in
 // descriptions or infer a genre solely from the venue itself.
 const ticketStart=section.search(/\b(?:TICKETS|ABENDKASSE|BOX OFFICE)\b/i);
 if(ticketStart>=40)section=section.slice(0,ticketStart);
 const description=clean(section).slice(0,4000);
 if(description.length<60)return null;
 const genres=extractExplicitGenresFromPublishedText(description);
 if(!genres.length)return null;
 const slug=DETAIL_PATH.exec(new URL(canonical).pathname)?.[1];
 if(!slug)return null;
 const image=$('meta[property="og:image"]').attr('content')?.trim();
 return {
  connectorId:ODONIEN_CONNECTOR_ID,sourceEventKey:'odonien:'+slug,
  listUrl:ODONIEN_LIST_URL,officialUrl:canonical,
  fetchedAt,pageFingerprint:createHash('sha256').update(JSON.stringify({
    title,startsAt:date.startsAt,description,genres,
  })).digest('hex'),
  title,startsAt:date.startsAt,sourceTimezone:'Europe/Berlin',
  venue:{name:'Odonien',city:'Köln',address:'Hornstraße 85',postalCode:'50823',countryCode:'DE'},
  organizerLabel:'Odonien Köln',descriptionClean:description,descriptionRaw:description,
  officialImageUrl:image?.startsWith('https://')?image:undefined,
  lineupCandidates:[],explicitGenreLabels:genres,
  enrichmentGaps:['lineup_not_verified'],
  rejectedCandidates:[],
 };
}
