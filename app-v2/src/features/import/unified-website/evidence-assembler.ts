import {
  createFieldEvidenceCandidate,
  type FieldEvidenceCandidate,
} from '@/features/import/contracts';
import { classifyStaleTicketDestination, staleEvidenceTriggersReview } from '@/features/import/domain/stale-evidence-policy';
import { decodeHtmlEntities, normalizeText } from '@/features/import/normalization/text-normalizer';

import type { DetailPageExtraction } from './types';
import type { UnifiedWebsiteImportContext } from './types';
import { UNIFIED_WEBSITE_IMPORTER_VERSION } from './types';

function decodeEntities(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function pushEvidence(
  candidates: FieldEvidenceCandidate[],
  fieldName: string,
  raw: unknown,
  normalized: unknown,
  ctx: UnifiedWebsiteImportContext,
  strategy: string,
  type: FieldEvidenceCandidate['evidenceType'],
  confidence: number,
  inclusionReason: string,
  sourceRole: FieldEvidenceCandidate['sourceRole'] = 'official_website_source',
  reviewState: FieldEvidenceCandidate['reviewState'] = 'not_reviewed',
): void {
  if (normalized === undefined || normalized === null || normalized === '') return;
  const normStr =
    typeof normalized === 'string'
      ? fieldName === 'description'
        ? normalizeText(normalized, 50_000) ?? decodeEntities(normalized)
        : decodeEntities(normalized)
      : normalized;
  candidates.push(
    createFieldEvidenceCandidate({
      fieldName,
      rawValue: raw,
      normalizedValue: normStr,
      sourceId: ctx.sourceId,
      sourceRole,
      originUrl: ctx.websiteUrl,
      evidenceType: type,
      extractionStrategy: strategy,
      observedAt: new Date().toISOString(),
      importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
      confidence,
      reliability: confidence,
      eventIdentityMatch: ctx.eventId,
      reviewState,
      inclusionReason,
    }),
  );
}

export function assembleFieldEvidence(
  detail: DetailPageExtraction,
  ctx: UnifiedWebsiteImportContext,
): { candidates: FieldEvidenceCandidate[]; diagnostics: DetailPageExtraction['diagnostics'] } {
  const candidates: FieldEvidenceCandidate[] = [];
  const diagnostics = [...detail.diagnostics];

  if (detail.title) {
    pushEvidence(
      candidates,
      'title',
      detail.title.rawTitle,
      detail.title.normalizedTitle,
      ctx,
      detail.title.suffixRemoved ? 'title_suffix_normalized' : 'og_or_json_ld',
      'html_text',
      detail.title.suffixRemoved ? 0.9 : 0.88,
      detail.title.suffixRemoved
        ? `Normalized title removed suffix: ${detail.title.removedSuffix}`
        : 'Official website title',
    );
  }

  if (detail.description?.description) {
    pushEvidence(
      candidates,
      'description',
      detail.description.boundaries?.cleanedText ?? detail.description.description,
      detail.description.description,
      ctx,
      detail.description.source,
      'html_text',
      detail.description.source === 'event_description_content' ? 0.92 : 0.86,
      `Official event body description from ${detail.description.source}`,
    );
  }

  if (detail.genres?.length) {
    pushEvidence(candidates, 'genres', detail.genres, detail.genres, ctx, 'provider_tag_container', 'html_text', 0.82, 'Genre tags from official page');
  }

  if (detail.flyerUrl) {
    pushEvidence(candidates, 'flyer', detail.flyerUrl, detail.flyerUrl, ctx, 'og_image', 'flyer', 0.9, 'Official website hero/flyer image');
  }

  if (detail.galleryUrls?.length) {
    pushEvidence(candidates, 'gallery', detail.galleryUrls, detail.galleryUrls, ctx, 'gallery_images', 'flyer', 0.88, 'Official website gallery images');
  }

  pushEvidence(candidates, 'date_time', detail.startDate, detail.startDate, ctx, 'json_ld_start', 'json_ld', 0.88, 'JSON-LD startDate');

  if (detail.venue) {
    pushEvidence(
      candidates,
      'venue',
      detail.venue.venueName,
      detail.venue.venueName,
      ctx,
      detail.venue.strategy,
      detail.venue.strategy === 'json_ld_venue' ? 'json_ld' : 'html_text',
      detail.venue.confidence,
      detail.venue.inclusionReason,
      'official_website_source',
      detail.venue.reviewState,
    );
  }

  pushEvidence(candidates, 'location', detail.venueAddress, detail.venueAddress, ctx, 'json_ld_address', 'json_ld', 0.85, 'JSON-LD address');
  pushEvidence(candidates, 'city', detail.cityName, detail.cityName, ctx, 'json_ld_city', 'json_ld', 0.85, 'JSON-LD city');

  if (detail.latitude !== undefined && detail.longitude !== undefined) {
    pushEvidence(
      candidates,
      'coordinates',
      { lat: detail.latitude, lng: detail.longitude },
      `${detail.latitude},${detail.longitude}`,
      ctx,
      'json_ld_geo',
      'json_ld',
      0.8,
      'JSON-LD coordinates',
    );
  }

  if (detail.organizerName) {
    pushEvidence(
      candidates,
      'organizer',
      detail.organizerName,
      detail.organizerName,
      ctx,
      'json_ld_organizer',
      'json_ld',
      0.85,
      'JSON-LD organizer',
      'organizer',
    );
  }

  if (detail.officialEventUrl) {
    pushEvidence(
      candidates,
      'official_event_url',
      detail.officialEventUrl,
      detail.officialEventUrl,
      ctx,
      'canonical_page_url',
      'html_text',
      0.9,
      'Official event page URL',
    );
  }

  if (detail.ticket?.url) {
    const staleSource =
      detail.ticket.strategy === 'json_ld_offer' ? 'json_ld_offer' : 'list_row';
    const stale = classifyStaleTicketDestination({
      candidateUrl: detail.ticket.url,
      verifiedUrl: ctx.verifiedTicketUrl,
      source: staleSource,
    });
    candidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'ticket_destination_candidate',
        rawValue: detail.ticket.url,
        normalizedValue: detail.ticket.url,
        sourceId: ctx.sourceId,
        sourceRole: 'official_website_source',
        originUrl: ctx.websiteUrl,
        evidenceType: detail.ticket.strategy === 'html_ticket_cta' ? 'html_text' : 'json_ld',
        extractionStrategy: detail.ticket.strategy,
        observedAt: new Date().toISOString(),
        importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
        confidence: stale.tier === 'stale_candidate' ? 0.35 : detail.ticket.strategy === 'html_ticket_cta' ? 0.92 : 0.65,
        reliability: stale.tier === 'stale_candidate' ? 0.35 : detail.ticket.strategy === 'html_ticket_cta' ? 0.92 : 0.65,
        eventIdentityMatch: ctx.eventId,
        reviewState: stale.tier === 'stale_candidate' ? 'pending' : 'not_reviewed',
        inclusionReason: stale.reason,
        rejectionReason: stale.canWinConsumerField ? undefined : 'Stale candidate cannot win consumer CTA',
      }),
    );
    if (staleEvidenceTriggersReview(stale)) {
      diagnostics.push({
        code: stale.diagnosticCode ?? 'STALE_EVIDENCE',
        message: stale.reason,
        surface: detail.ticket.strategy,
      });
    }
  }

  return { candidates, diagnostics };
}
