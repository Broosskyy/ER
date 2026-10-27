import type { OfficialConnector,OfficialConnectorDiscoveryResult,OfficialConnectorFetchResult,
 OfficialConnectorMetadata,OfficialConnectorRunOptions,OfficialConnectorRunResult } from '../connector-contract';
import { safeFetchHtmlWithPolicy,type SafeFetchUrlPolicy,
 type SafeFetchRequestContext,type SafeFetchRequestOptions } from '../generic-safe-fetch';
import { createEmptyMediaPassCounters } from '../media-evidence';
import { createEmptyConnectorCounters,type ConnectorErrorCounters,type OfficialEventEvidence } from '../types';
import { buildConsumerPreview } from '../preview';
import { processOfficialEventTickets,resetTicketFetchCache } from '../ticket-evidence/ticket-evidence-pipeline';
import { TRESOR_CONNECTOR_ID,TRESOR_LIST_URL,canonicalizeTresorUrl,isTresorEventUrl,
 findTresorEvents,parseTresorDetail } from './parse-event';

const policy:SafeFetchUrlPolicy={
 userAgent:'EternalRave-OfficialClubSource/1.0 (+source checked events)',
 canonicalizeUrl:canonicalizeTresorUrl,
 resolveRedirectUrl:(current,location)=>location?canonicalizeTresorUrl(location,current):null,
 validateRequestUrl:(url,ctx)=>{
   if(ctx.allowListOnly&&url!==TRESOR_LIST_URL)return 'disallowed_path';
   if(ctx.allowDetailOnly&&!isTresorEventUrl(url))return 'disallowed_path';
   return null;
 },
 isCrossOriginRedirect:()=>true,
};
export class TresorOfficialConnector implements OfficialConnector {
 readonly metadata:OfficialConnectorMetadata={
  connectorId:TRESOR_CONNECTOR_ID,sourceType:'venue_club',
  displayName:'Official Tresor Berlin electronic calendar',defaultListUrl:TRESOR_LIST_URL,
  capabilities:{listDiscovery:true,detailFetch:true,mediaEnrichment:false},
 };
 discoverFromListHtml(html:string,listUrl:string):OfficialConnectorDiscoveryResult{
  return {listUrl,detailUrls:findTresorEvents(html,new Date('2026-01-01')),duplicateCount:0};
 }
 async fetchHtml(url:string,opts:SafeFetchRequestOptions,ctx:SafeFetchRequestContext={}):Promise<OfficialConnectorFetchResult>{
  return safeFetchHtmlWithPolicy(url,policy,opts,ctx);
 }
 parseDetailPage(html:string,finalUrl:string,fetchedAt:string,_counters:ConnectorErrorCounters):OfficialEventEvidence{
  const parsed=parseTresorDetail(html,finalUrl,fetchedAt);
  if(!parsed)throw new Error('tresor_missing_explicit_event_start_time');
  return parsed;
 }
 async runPreview(options:OfficialConnectorRunOptions={}):Promise<OfficialConnectorRunResult>{
  const now=options.now?.()??new Date(),fetchedAt=now.toISOString();
  const counters=createEmptyConnectorCounters();
  const listing=await this.fetchHtml(TRESOR_LIST_URL,{counters},{allowListOnly:true});
  const discovered=findTresorEvents(listing.html,now);
  const urls=discovered.slice(0,Math.min(24,options.maxDetailPages??24));
  const previews:OfficialConnectorRunResult['previews']=[];
  const tickets:NonNullable<OfficialConnectorRunResult['ticketResults']>=[];
  const fetched:string[]=[];
  resetTicketFetchCache();
  for(const url of urls){
    try{
      const result=await this.fetchHtml(url,{counters},{allowDetailOnly:true});
      fetched.push(url);
      const evidence=parseTresorDetail(result.html,result.finalUrl,fetchedAt);
      if(!evidence||Date.parse(evidence.startsAt)<=now.getTime())continue;
      previews.push(buildConsumerPreview(evidence,counters));
      const t=await processOfficialEventTickets({
        sourceEventKey:evidence.sourceEventKey,officialUrl:evidence.officialUrl,
        title:evidence.title,startsAt:evidence.startsAt,venueName:evidence.venue?.name,
        organizerName:evidence.organizerLabel,
      },{prefetchedHtml:result.html,observedAt:fetchedAt});
      tickets.push(t);
    }catch(error){
      console.warn('[tresor] detail_skip',url,error instanceof Error?error.message:'unknown');
    }
  }
  console.log('[tresor] discovery '+JSON.stringify({discovered:discovered.length,fetched:fetched.length,parsed:previews.length}));
  return {fetchedAt,listUrl:TRESOR_LIST_URL,discoveredDetailUrls:discovered,
   loadedDetailUrls:fetched,previews,counters,ticketResults:tickets,
   mediaCounters:createEmptyMediaPassCounters()};
 }
}
