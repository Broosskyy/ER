import type { EvidenceReviewState } from '@/features/import/contracts/evidence-types';

export type VenueEvidenceStrategy =
  | 'explicit_page_field'
  | 'json_ld_venue'
  | 'body_location_block'
  | 'provider_default_candidate'
  | 'none';

export interface VenueEvidenceCandidate {
  venueName: string;
  strategy: VenueEvidenceStrategy;
  confidence: number;
  reliability: number;
  reviewState: EvidenceReviewState;
  inclusionReason: string;
  rejectionReason?: string;
}

export interface VenueExtractionInput {
  html: string;
  pageUrl: string;
  jsonLdVenueName?: string;
  jsonLdVenueAddress?: string;
  organizerName?: string;
  providerKey?: string;
  explicitPageVenue?: string;
  providerDefaultVenue?: string;
  providerDefaultAllowed?: boolean;
}

function extractExplicitPageVenueField(html: string): string | undefined {
  const patterns = [
    /<[^>]*class="[^"]*event-venue[^"]*"[^>]*>([\s\S]*?)<\//i,
    /<[^>]*class="[^"]*ecm-event-single__venue[^"]*"[^>]*>([\s\S]*?)<\//i,
    /<div[^>]*class="[^"]*tribe-venue[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const raw = match?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw && raw.length >= 2 && raw.length < 120) {
      return raw;
    }
  }
  return undefined;
}

/**
 * Venue evidence hierarchy — never fabricate venue from host domain alone.
 */
export function extractVenueEvidence(input: VenueExtractionInput): VenueEvidenceCandidate | undefined {
  const explicitField = input.explicitPageVenue ?? extractExplicitPageVenueField(input.html);
  if (explicitField) {
    return {
      venueName: explicitField,
      strategy: 'explicit_page_field',
      confidence: 0.9,
      reliability: 0.9,
      reviewState: 'not_reviewed',
      inclusionReason: 'Explicit venue field on official event page',
    };
  }

  if (input.jsonLdVenueName?.trim()) {
    return {
      venueName: input.jsonLdVenueName.trim(),
      strategy: 'json_ld_venue',
      confidence: 0.88,
      reliability: 0.88,
      reviewState: 'not_reviewed',
      inclusionReason: 'JSON-LD venue on official event page',
    };
  }

  if (input.providerDefaultAllowed && input.providerDefaultVenue?.trim()) {
    return {
      venueName: input.providerDefaultVenue.trim(),
      strategy: 'provider_default_candidate',
      confidence: 0.55,
      reliability: 0.45,
      reviewState: 'pending',
      inclusionReason:
        'Provider default venue candidate — requires review; must not override stronger external venue evidence',
    };
  }

  return undefined;
}
