import { createHash } from 'node:crypto';
import type {
  OfficialConnector, OfficialConnectorDiscoveryResult,
  OfficialConnectorFetchResult, OfficialConnectorMetadata,
  OfficialConnectorRunOptions, OfficialConnectorRunResult,
} from '../connector-contract';
import type { SafeFetchRequestContext, SafeFetchRequestOptions } from '../generic-safe-fetch';
import {
  createEmptyConnectorCounters, type ConnectorErrorCounters,
  type OfficialEventEvidence,
} from '../types';
import { createEmptyMediaPassCounters } from '../media-evidence';
import { buildConsumerPreview } from '../preview';
import { defaultTicketProviderRegistry } from '../ticket-evidence/provider-registry';
import { readTicketIoOfficialCore } from './read-official-event-core';
import { isTicketProviderBlockedBody } from '../ticket-evidence/safe-fetch-ticket';
import { processOfficialEventTickets, resetTicketFetchCache } from '../ticket-evidence/ticket-evidence-pipeline';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import { extractExplicitGenresFromPublishedText } from '../shared/published-genre-evidence';
import { normalizeOfficialGenreLabels } from '../shared/normalize-genre';
import { inferLineupEvidenceRole, validateOfficialLineupAct } from '../shared/lineup-normalization';
import { APPROVED_TICKETIO_SHOP_HOSTS, isApprovedTicketIoEventUrl, listApprovedTicketIoShopEvents, pickBalancedTicketIoEventUrls } from './url-policy';

export const TICKETIO_ORGANIZER_CONNECTOR_ID = 'ticketio-organizer-discovery';
const MAX_DETAILS = 40;
const sourceHeader = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
};

function assertSourceUrl(url: URL): void {
  if (url.protocol !== 'https:' || !APPROVED_TICKETIO_SHOP_HOSTS.includes(url.hostname as never) ||
      (url.pathname !== '/' && !isApprovedTicketIoEventUrl(url.toString())) ||
      url.username || url.password) {
    throw new Error('ticketio_organizer_source_not_approved');
  }
}

export class TicketIoOrganizerOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata = {
    connectorId: TICKETIO_ORGANIZER_CONNECTOR_ID,
    sourceType: 'event_platform',
    displayName: 'Approved official ticket.io organizer shops',
    defaultListUrl: 'https://' + APPROVED_TICKETIO_SHOP_HOSTS[0] + '/',
    capabilities: { listDiscovery: true, detailFetch: true, mediaEnrichment: false },
  };

  discoverFromListHtml(html: string, listUrl: string): OfficialConnectorDiscoveryResult {
    let host='';
    try { host = new URL(listUrl).hostname; } catch { return { listUrl,detailUrls:[],duplicateCount:0 }; }
    return {
      listUrl,
      detailUrls: listApprovedTicketIoShopEvents(html, host),
      duplicateCount: 0,
    };
  }

  async fetchHtml(
    rawUrl: string, _options: SafeFetchRequestOptions,
    _context: SafeFetchRequestContext = {},
  ): Promise<OfficialConnectorFetchResult> {
    const url = new URL(rawUrl);
    assertSourceUrl(url);
    const response = await fetch(url, {
      headers: sourceHeader, redirect:'follow',
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
      throw new Error('ticketio_organizer_page_not_html:' + response.status);
    const finalUrl = new URL(response.url);
    assertSourceUrl(finalUrl);
    if (finalUrl.hostname !== url.hostname) throw new Error('ticketio_cross_shop_redirect');
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('ticketio_source_page_too_large');
    return { finalUrl: finalUrl.toString(), html, contentType: 'text/html' };
  }

  parseDetailPage(
    _html: string, _finalUrl: string, _fetchedAt: string,
    _counters: ConnectorErrorCounters,
  ): OfficialEventEvidence {
    // Provider title/date/venue, verified electronic genre and description are
    // read together in runPreview. Standalone parsing without that provider
    // identity context is deliberately disabled.
    throw new Error('ticketio_provider_evidence_required');
  }

  async runPreview(options: OfficialConnectorRunOptions = {}): Promise<OfficialConnectorRunResult> {
    const counters = createEmptyConnectorCounters();
    const now = options.now?.() ?? new Date();
    const fetchedAt = now.toISOString();
    const shopLists: string[][] = [];

    // Fail closed if one approved shop cannot be fetched: skipping a single
    // provider should not fabricate missing prices or duplicate other shops.
    for (const host of APPROVED_TICKETIO_SHOP_HOSTS) {
      const root='https://' + host + '/';
      const list=await this.fetchHtml(root,{counters},{allowListOnly:true});
      shopLists.push(this.discoverFromListHtml(list.html,list.finalUrl).detailUrls);
    }
    const discovered=[...new Set(shopLists.flat())];
    const urls=pickBalancedTicketIoEventUrls(shopLists,Math.min(MAX_DETAILS,options.maxDetailPages ?? MAX_DETAILS));
    const previews: OfficialConnectorRunResult['previews']=[];
    const ticketResults:VerifiedTicketCompleteResult[]=[];
    const loaded:string[]=[];
    // Counts of publicly fetched pages that did not meet mandatory quality.
    // Avoid logging page bodies or personal information.
    const qualityReasons = {
      provider_not_ticketio:0,
      provider_missing_title:0,
      public_html_has_event_title:0,
      public_html_has_date:0,
      public_html_has_venue_city:0,
      page_has_challenge_marker:0,
      missing_title:0,
      missing_or_past_date:0,
      missing_venue_or_city:0,
      missing_event_description:0,
      missing_explicit_genre:0,
      foreign_venue:0,
      selected:0,
    };
    resetTicketFetchCache();

    for (const url of urls) {
      // Ticket shops are first-party sources: the event page also is the
      // canonical purchase target. No homepage, session or checkout URL is
      // stored in its place.
      const page=await this.fetchHtml(url,{counters},{allowDetailOnly:true});
      loaded.push(url);
      const provider=defaultTicketProviderRegistry.resolveProvider(new URL(page.finalUrl));
      if (!provider || provider.providerKey !== 'ticket_io') {
        qualityReasons.provider_not_ticketio++;
        continue;
      }
      const sha=createHash('sha256').update(page.html).digest('hex');
      const verified=await provider.fetchEventEvidence({
        url:new URL(page.finalUrl),
        canonicalTicketUrl:page.finalUrl,
        redirectChain:[page.finalUrl],
        body:page.html, contentType:'text/html',fingerprint:sha,
        observedAt:fetchedAt,extractedAt:fetchedAt,
      });
      const event=verified.event;
      // Official event-core details are independent of whether checkout was
      // verifiable. Ticket price/status/link remain separately provider-gated.
      const official=readTicketIoOfficialCore(page.html,event);
      if (!event.rawTitle?.trim()) qualityReasons.provider_missing_title++;
      if (official.sourceTitleFound) qualityReasons.public_html_has_event_title++;
      if (official.sourceDateFound) qualityReasons.public_html_has_date++;
      if (official.sourceVenueFound) qualityReasons.public_html_has_venue_city++;
      if (isTicketProviderBlockedBody(page.html,'text/html'))
        qualityReasons.page_has_challenge_marker++;
      const title=official.title;
      const startsAt=official.startsAt;
      const venueName=official.venueName;
      const city=official.cityName;
      const description=(verified.supplementalContent?.descriptionClean ??
        event.description ?? official.descriptionClean ?? '').trim();
      const explicitLabels=[
        ...(verified.supplementalContent?.genreLabels ?? []),
        ...extractExplicitGenresFromPublishedText(title + ' ' + description),
      ];
      const genres=normalizeOfficialGenreLabels(explicitLabels).normalized.map(label=>label.displayName);
      // Evaluate eligibility in a fixed, exclusive order: every rejected
      // official URL is counted once and explained in the GitHub run logs.
      if (!title) { qualityReasons.missing_title++; continue; }
      if (!startsAt || !Number.isFinite(Date.parse(startsAt)) ||
          Date.parse(startsAt) <= now.getTime()) {
        qualityReasons.missing_or_past_date++;
        continue;
      }
      if (!venueName || !city) { qualityReasons.missing_venue_or_city++; continue; }
      if (description.length < 40) { qualityReasons.missing_event_description++; continue; }
      if (genres.length === 0) { qualityReasons.missing_explicit_genre++; continue; }
      if (/\b(?:Netherlands|Nederland|Niederlande|Belgium|Belgien|Austria|Österreich)\b/i.test(
        event.venueAddress ?? official.venueAddress ?? '',
      )) { qualityReasons.foreign_venue++; continue; }
      qualityReasons.selected++;

      const supplemental=verified.supplementalContent?.lineupCandidates ?? [];
      const lineup=supplemental
        .filter(act=>validateOfficialLineupAct(act.displayName,'explicit_sentence').accepted)
        .slice(0,30)
        .map((act,index)=>({
          displayName:act.displayName,rawText:act.rawText,
          billingOrder:index,evidenceRole:inferLineupEvidenceRole(act.displayName,index),
          evidenceOrigin:'official_text' as const,
        }));
      const evidence:OfficialEventEvidence={
        connectorId:TICKETIO_ORGANIZER_CONNECTOR_ID,
        sourceEventKey:'ticketio:' + new URL(page.finalUrl).hostname + ':' + new URL(page.finalUrl).pathname.split('/')[1],
        listUrl:'https://' + new URL(page.finalUrl).hostname + '/',
        officialUrl:page.finalUrl,
        fetchedAt,pageFingerprint:createHash('sha256').update(JSON.stringify({
          title,startsAt,venueName,city,description,genres,lineup,
        })).digest('hex'),
        title,startsAt,endsAt:event.endAt,sourceTimezone:'Europe/Berlin',
        venue:{name:venueName,city,address:event.venueAddress ?? official.venueAddress,
          countryCode:/\b(?:Deutschland|Germany)\b/i.test(
            event.venueAddress ?? official.venueAddress ?? '')?'DE':undefined},
        organizerLabel:event.organizerName,
        descriptionClean:description,descriptionRaw:description,
        officialImageUrl:event.imageUrl?.startsWith('https://')?event.imageUrl:undefined,
        linkedTicketUrl:page.finalUrl,
        explicitGenreLabels:[...new Set(genres)],
        lineupCandidates:lineup,
        enrichmentGaps:lineup.length ? [] : ['lineup_not_announced'],
        rejectedCandidates:[],
      };
      const ticket=await processOfficialEventTickets({
        sourceEventKey:evidence.sourceEventKey,officialUrl:evidence.officialUrl,
        title:evidence.title,startsAt:evidence.startsAt,
        venueName:evidence.venue?.name,
      },{prefetchedHtml:page.html,observedAt:fetchedAt});
      // Ticket price, status and identity are independently checked by
      // the existing ticket.io pipeline, not copied from shop marketing text.
      ticketResults.push(ticket);
      previews.push(buildConsumerPreview(evidence,counters));
    }

    // This is the source of truth for the next integration correction. A
    // discovered=44/fetched=30/parsed=0 outcome must not look healthy again.
    console.log('[ticketio-organizer] source-quality-audit ' + JSON.stringify({
      discovered:discovered.length,fetched:loaded.length,parsed:previews.length,
      reasons:qualityReasons,
    }));
    return {
      fetchedAt,listUrl:this.metadata.defaultListUrl!,
      discoveredDetailUrls:discovered,loadedDetailUrls:loaded,
      previews,counters,ticketResults,sourceQualityAudit:qualityReasons,
      mediaCounters:createEmptyMediaPassCounters(),
    };
  }
}
