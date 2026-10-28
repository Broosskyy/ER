import type {
  OfficialConnector,OfficialConnectorDiscoveryResult,OfficialConnectorFetchResult,
  OfficialConnectorMetadata,OfficialConnectorRunOptions,OfficialConnectorRunResult,
} from '../connector-contract';
import { safeFetchHtmlWithPolicy, type SafeFetchUrlPolicy,
 type SafeFetchRequestContext, type SafeFetchRequestOptions } from '../generic-safe-fetch';
import { createEmptyMediaPassCounters } from '../media-evidence';
import { createEmptyConnectorCounters,type ConnectorErrorCounters,type OfficialEventEvidence } from '../types';
import { buildConsumerPreview } from '../preview';
import { processOfficialEventTickets,resetTicketFetchCache } from '../ticket-evidence/ticket-evidence-pipeline';
import { ODONIEN_CONNECTOR_ID,ODONIEN_LIST_URL,canonicalizeOdonienUrl,
  isOdonienEventUrl,discoverOdonienClubEventUrls,parseOdonienClubDetail } from './parse-official-event';

const fetchPolicy:SafeFetchUrlPolicy={
  userAgent:'EternalRave-OfficialClubSource/1.0 (+public club calendar; rate limited)',
  canonicalizeUrl:canonicalizeOdonienUrl,
  resolveRedirectUrl:(current,location)=>location?canonicalizeOdonienUrl(location,current):null,
  validateRequestUrl:(url,ctx)=>{
    if(ctx.allowListOnly && url!==ODONIEN_LIST_URL)return 'disallowed_path';
    if(ctx.allowDetailOnly && !isOdonienEventUrl(url))return 'disallowed_path';
    return null;
  },
  isCrossOriginRedirect:()=>true,
};
export class OdonienOfficialConnector implements OfficialConnector {
 readonly metadata:OfficialConnectorMetadata={
  connectorId:ODONIEN_CONNECTOR_ID,sourceType:'venue_club',
  displayName:'Odonien Cologne – Official Club Calendar',
  defaultListUrl:ODONIEN_LIST_URL,
  capabilities:{listDiscovery:true,detailFetch:true,mediaEnrichment:false},
 };
 discoverFromListHtml(html:string,listUrl:string):OfficialConnectorDiscoveryResult {
  return {listUrl,detailUrls:discoverOdonienClubEventUrls(html),duplicateCount:0};
 }
 async fetchHtml(url:string,options:SafeFetchRequestOptions,ctx:SafeFetchRequestContext={}):Promise<OfficialConnectorFetchResult>{
  return safeFetchHtmlWithPolicy(url,fetchPolicy,options,ctx);
 }
 parseDetailPage(html:string,url:string,fetchedAt:string,_counters:ConnectorErrorCounters):OfficialEventEvidence {
  const event=parseOdonienClubDetail(html,url,fetchedAt);
  if(!event)throw new Error('odonien_missing_verified_dance_event_facts');
  return event;
 }
 async runPreview(options:OfficialConnectorRunOptions={}):Promise<OfficialConnectorRunResult> {
  const now=options.now?.()??new Date();
  const fetchedAt=now.toISOString();
  const counters=createEmptyConnectorCounters();
  const list=await this.fetchHtml(ODONIEN_LIST_URL,{counters,timeoutMs:options.timeoutMs},{allowListOnly:true});
  const urls=discoverOdonienClubEventUrls(list.html);
  const limit=Math.min(22,options.maxDetailPages??22);
  const selected=urls.slice(0,limit);
  const previews:OfficialConnectorRunResult['previews']=[];
  const ticketResults:NonNullable<OfficialConnectorRunResult['ticketResults']>=[];
  const loaded:string[]=[];
  const reasons={invalidOrOutOfScope:0,pastEvents:0,detailsFailed:0,accepted:0};
  resetTicketFetchCache();
  // Bounded one-at-a-time detail fetch is deliberate for this small official
  // venue source. No scraping browser protections or unverified ticket URLs.
  for(const url of selected) {
    try {
      const page=await this.fetchHtml(url,{counters,timeoutMs:options.timeoutMs},{allowDetailOnly:true});
      loaded.push(url);
      const evidence=parseOdonienClubDetail(page.html,page.finalUrl,fetchedAt);
      if(!evidence){reasons.invalidOrOutOfScope++;continue;}
      if(Date.parse(evidence.startsAt)<=now.getTime()){reasons.pastEvents++;continue;}
      previews.push(buildConsumerPreview(evidence,counters));
      const ticket=await processOfficialEventTickets({
        sourceEventKey:evidence.sourceEventKey,officialUrl:evidence.officialUrl,
        title:evidence.title,startsAt:evidence.startsAt,
        venueName:evidence.venue?.name,organizerName:evidence.organizerLabel,
      },{prefetchedHtml:page.html,observedAt:fetchedAt});
      ticketResults.push(ticket);
      reasons.accepted++;
    }catch(error) {
      reasons.detailsFailed++;
      console.warn('[odonien] verified club detail unavailable',url,error instanceof Error?error.message:'unknown');
    }
  }
  console.log('[odonien] official club audit '+JSON.stringify({
    discovered:urls.length,loaded:loaded.length,parsed:previews.length,reasons,
  }));
  return {
    fetchedAt,listUrl:ODONIEN_LIST_URL,discoveredDetailUrls:urls,
    loadedDetailUrls:loaded,previews,counters,
    ticketResults,mediaCounters:createEmptyMediaPassCounters(),
    sourceQualityAudit:reasons,
  };
 }
}
