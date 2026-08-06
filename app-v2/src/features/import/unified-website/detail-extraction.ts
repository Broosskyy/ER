import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';

import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

import { extractEventDescription, extractLineupFromDescriptionHtml } from './description-extraction';
import { extractGalleryUrls } from './gallery-extraction';
import { extractOgMeta } from './html-meta';
import { resolveProviderAdapter } from './provider-adapters';
import { extractTicketUrl } from './ticket-extraction';
import { normalizeOfficialPageTitle } from './title-normalization';
import type { DetailPageExtraction } from './types';
import { extractVenueEvidence } from './venue-evidence';

function extractH1Title(html: string): string | undefined {
  const ecm = html.match(/<h1[^>]*class="[^"]*ecm-event-single__title[^"]*"[^>]*>([^<]+)</i);
  if (ecm?.[1]) return decodeHtmlEntities(ecm[1].trim());
  const tribe = html.match(/<h1[^>]*class="[^"]*tribe-events-single-event-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (tribe?.[1]) return decodeHtmlEntities(tribe[1].replace(/<[^>]+>/g, '').trim());
  return undefined;
}

export function extractDetailPage(html: string, pageUrl: string): DetailPageExtraction {
  const diagnostics: DetailPageExtraction['diagnostics'] = [];
  const og = extractOgMeta(html);
  const description = extractEventDescription(html);
  const ticket = extractTicketUrl(html, pageUrl);
  const adapter = resolveProviderAdapter(pageUrl);

  if (description.rejectedShortMeta) {
    diagnostics.push({
      code: 'SHORT_META_REJECTED',
      message: `Rejected short meta description: ${description.rejectedShortMeta}`,
      surface: 'website',
    });
  }
  if (description.contaminationRejected) {
    diagnostics.push({
      code: 'CONTAMINATION_REJECTED',
      message: 'Page content rejected due to site chrome contamination',
      surface: 'website',
    });
  }
  if (description.boundaries?.removedBlocks.length) {
    diagnostics.push({
      code: 'DESCRIPTION_BOILERPLATE_REMOVED',
      message: `Removed ${description.boundaries.removedBlocks.length} footer block(s): ${description.boundaries.removedBlocks.map((b) => b.reason).join(', ')}`,
      surface: 'website',
    });
  }
  if (ticket.rejectedPromotional?.length) {
    diagnostics.push({
      code: 'PROMOTIONAL_TICKET_REJECTED',
      message: `Rejected promotional ticket links: ${ticket.rejectedPromotional.join(', ')}`,
      surface: 'ticket',
    });
  }

  let jsonLdFields: Record<string, unknown> = {};
  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      jsonLdFields = parseJsonLdEvent(node, pageUrl).fields;
      break;
    }
    if (Object.keys(jsonLdFields).length > 0) break;
  }

  const rawTitle =
    decodeHtmlEntities(
      String((jsonLdFields.title as string | undefined) ?? extractH1Title(html) ?? og.title ?? ''),
    ) || undefined;
  const title = rawTitle
    ? normalizeOfficialPageTitle(rawTitle, adapter?.titleSuffixPatterns)
    : undefined;

  const genres = adapter?.extractGenres?.(html);
  const primaryImage = (jsonLdFields.imageUrl as string | undefined) ?? og.imageUrl;
  const galleryUrls = adapter?.extractGallery?.(html, primaryImage) ?? extractGalleryUrls(html, primaryImage);

  const lineup = extractLineupFromDescriptionHtml(html);
  if (lineup.state === 'tba') {
    diagnostics.push({
      code: 'LINEUP_TBA',
      message: lineup.inclusionReason,
      surface: 'lineup',
    });
  }

  const venue = extractVenueEvidence({
    html,
    pageUrl,
    jsonLdVenueName: jsonLdFields.venueName as string | undefined,
    jsonLdVenueAddress: jsonLdFields.venueAddress as string | undefined,
    organizerName: jsonLdFields.organizerName as string | undefined,
    providerKey: adapter?.key,
    explicitPageVenue: adapter?.extractExplicitVenueProof?.(html),
    providerDefaultVenue: adapter?.providerDefaultVenueLabel,
    providerDefaultAllowed: adapter?.allowProviderDefaultVenue?.(html) ?? false,
  });

  if (!venue) {
    diagnostics.push({
      code: 'VENUE_NOT_PUBLISHED_ON_PAGE',
      message: 'No explicit venue evidence on official event page',
      surface: 'venue',
    });
  }

  return {
    title,
    description,
    genres,
    flyerUrl: primaryImage,
    galleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
    startDate: jsonLdFields.startDate as string | undefined,
    endDate: jsonLdFields.endDate as string | undefined,
    venue,
    venueAddress: jsonLdFields.venueAddress as string | undefined,
    cityName: jsonLdFields.cityName as string | undefined,
    latitude: jsonLdFields.latitude as number | undefined,
    longitude: jsonLdFields.longitude as number | undefined,
    organizerName: jsonLdFields.organizerName as string | undefined,
    ticket,
    lineup,
    officialEventUrl: (jsonLdFields.eventUrl as string | undefined) ?? og.url ?? pageUrl,
    diagnostics,
  };
}
