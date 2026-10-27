import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { applyTimeToIsoDate } from '../stadtgarten/parse-datetime';
import { extractExplicitGenresFromPublishedText } from '../shared/published-genre-evidence';
import { inferLineupEvidenceRole,validateOfficialLineupAct } from '../shared/lineup-normalization';
import type { OfficialEventEvidence,OfficialLineupCandidate } from '../types';

export const TRESOR_CONNECTOR_ID='tresor-berlin-official';
export const TRESOR_LIST_URL='https://tresorberlin.com/club/events/';
const EVENT_PATH=/^\/event\/(\d{4})(\d{2})(\d{2})-([a-z0-9-]+)\/?$/i;

export function canonicalizeTresorUrl(raw:string,base=TRESOR_LIST_URL):string|null {
  try{
    const u=new URL(raw,base);
    if(u.protocol!=='https:'||u.hostname!=='tresorberlin.com'||
       u.username||u.password||(u.pathname!=='/club/events/'&&!EVENT_PATH.test(u.pathname)))return null;
    return 'https://tresorberlin.com'+u.pathname.replace(/\/?$/,'/');
  }catch{return null;}
}
export function isTresorEventUrl(raw:string):boolean{
  const s=canonicalizeTresorUrl(raw);
  return !!s && EVENT_PATH.test(new URL(s).pathname);
}
export function findTresorEvents(html:string,now=new Date()):string[]{
  const $=cheerio.load(html);
  const set=new Set<string>();
  $('a[href]').each((_i,el)=>{
    const url=canonicalizeTresorUrl($(el).attr('href')||'');
    if(!url || !isTresorEventUrl(url))return;
    const m=EVENT_PATH.exec(new URL(url).pathname)!;
    const stamp=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),23,59);
    const date=new Date(stamp);
    if(date.getUTCFullYear()!==Number(m[1])||date.getUTCMonth()!==Number(m[2])-1||
       date.getUTCDate()!==Number(m[3])||stamp+86400000<now.getTime())return;
    set.add(url);
  });
  return [...set].sort();
}
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
export function parseTresorDetail(html:string,url:string,fetchedAt:string):OfficialEventEvidence|null{
  const canonical=canonicalizeTresorUrl(url);
  if(!canonical||!isTresorEventUrl(canonical))return null;
  const date=EVENT_PATH.exec(new URL(canonical).pathname)!;
  const $=cheerio.load(html);
  $('nav,footer,script,style,noscript').remove();
  const title=$('h1,h2').toArray().map(el=>clean($(el).text())).find(t=>
    t.length>5 && t.length<150 && !/^(?:guest information|ticket policy|tresor berlin|club|events|info|lockers)$/i.test(t));
  if(!title)return null;
  const body=clean($('body').text());
  const heading=body.indexOf(title);
  if(heading<0)return null;
  const section0=body.slice(heading+title.length);
  const stop=/\bGuest Information\b|\bTicket Policy\b|\bGUEST INFO\b/i.exec(section0);
  const section=clean(section0.slice(0,stop?stop.index:5000)).slice(0,5000);
  // Only published stage schedules provide a start hour; do not guess one.
  const schedules=[...section.matchAll(/\b([012]?\d):([0-5]\d)\s*[–-]\s*(?:[012]?\d:[0-5]\d|END)\b/gi)];
  const evening=schedules.map(m=>Number(m[1])).filter(h=>h>=18&&h<=23);
  if(!evening.length)return null;
  const localDate=date[1]+'-'+date[2]+'-'+date[3];
  const startsAt=applyTimeToIsoDate(localDate+'T00:00:00+01:00',Math.min(...evening),0);
  if(!startsAt)return null;
  const artists:OfficialLineupCandidate[]=[];
  const actPattern=/\b[012]?\d:[0-5]\d\s*[–-]\s*(?:[012]?\d:[0-5]\d|END)\s+([\s\S]*?)(?=\s+[012]?\d:[0-5]\d\s*[–-]\s*(?:[012]?\d:[0-5]\d|END)\b|$)/gi;
  for(const m of section.matchAll(actPattern)){
    const raw=clean(m[1]||'').split(/\b(?:Globus|Aurora Bar|Tresor x|Guest Information|Listening Session:)\b/i)[0]?.trim()||'';
    const name=raw.replace(/\s+(?:LIVE(?:\s+SET)?|HYBRID|DJ SET)$/i,'').trim();
    if(!name||name.length>65 || /\b(?:ticket|guest|lockers|door|policy|info)\b/i.test(name)||
       !validateOfficialLineupAct(name,'explicit_sentence').accepted||
       artists.some(a=>a.displayName.toLowerCase()===name.toLowerCase()))continue;
    artists.push({displayName:name,rawText:raw,billingOrder:artists.length,
      evidenceRole:inferLineupEvidenceRole(name,artists.length),evidenceOrigin:'official_text'});
    if(artists.length>=24)break;
  }
  // Only exact event-specific source facts. Unannounced lineup is omitted.
  const names=artists.slice(0,12).map(a=>a.displayName).join(', ');
  const description=names
    ? 'Offizielles Tresor-Clubprogramm in Berlin: '+title+'. Veröffentlichtes Line-up: '+names+'.'
    : 'Offizielles Tresor-Clubprogramm in Berlin: '+title+'. Veröffentlichtes Setprogramm: '+section.slice(0,300)+'.';
  const genres=extractExplicitGenresFromPublishedText(title+' '+section);
  const image=$('meta[property="og:image"]').attr('content');
  return {connectorId:TRESOR_CONNECTOR_ID,sourceEventKey:'tresor:'+date[1]+date[2]+date[3]+'-'+date[4],
    listUrl:TRESOR_LIST_URL,officialUrl:canonical,fetchedAt,
    pageFingerprint:createHash('sha256').update(JSON.stringify({canonical,title,startsAt,section})).digest('hex'),
    title,startsAt,sourceTimezone:'Europe/Berlin',
    venue:{name:'Tresor',city:'Berlin',address:'Köpenicker Straße 70',postalCode:'10179',countryCode:'DE'},
    organizerLabel:'Tresor Berlin',descriptionClean:description,descriptionRaw:description,
    officialImageUrl:image?.startsWith('https://')?image:undefined,
    lineupCandidates:artists,explicitGenreLabels:genres,
    enrichmentGaps:[...(!artists.length?['lineup_not_announced']:[]),
      ...(!genres.length?['genres_not_explicitly_published']:[])],
    rejectedCandidates:[]};
}
