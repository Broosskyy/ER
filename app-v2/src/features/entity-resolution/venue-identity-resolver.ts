import type { MatchingCatalog } from '@/features/import/matching/match-result';
import { venueMatchingService } from '@/features/import/matching/venue-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

import { readCandidateMetadataString } from '@/features/import/matching/entity-resolution-match-bridge';

import {
  buildEntityCandidateKey,
  extractDomain,
  normalizeIdentityText,
} from './entity-alias-store';
import type { EntityAliasStore, EntityResolutionOutcome } from './types';

const REVIEW_THRESHOLD = 80;
const MATCH_THRESHOLD = 95;

export interface VenueIdentityInput {
  candidate: NormalizedEventCandidate;
  catalog: MatchingCatalog;
  sourceId: string;
  externalVenueId?: string;
  websiteUrl?: string;
  matchedCityId?: string;
}

export class VenueIdentityResolver {
  constructor(private readonly aliases: EntityAliasStore) {}

  resolve(input: VenueIdentityInput): EntityResolutionOutcome {
    const candidateKey = buildEntityCandidateKey({
      sourceId: input.sourceId,
      externalId: input.externalVenueId,
      name: input.candidate.venueName,
      address: input.candidate.venueAddress,
      city: input.candidate.cityName,
      url: input.websiteUrl,
    });

    const manual = this.aliases.getDecision('venue', candidateKey);
    if (manual?.decision === 'keep_separate') {
      return {
        entityType: 'venue',
        decision: 'keep_separate',
        canonicalId: manual.canonicalId,
        confidenceScore: 100,
        candidateIds: manual.canonicalId ? [manual.canonicalId] : [],
        reasonCodes: ['manual_keep_separate'],
      };
    }
    if (manual?.decision === 'manual_override' && manual.canonicalId) {
      return {
        entityType: 'venue',
        decision: 'manual_override',
        canonicalId: manual.canonicalId,
        confidenceScore: 100,
        candidateIds: [manual.canonicalId],
        reasonCodes: ['manual_override'],
      };
    }

    const defaultVenueId = readCandidateMetadataString(input.candidate, 'defaultVenueId');
    const externalLocationFromTitle =
      input.candidate.sourceMetadata &&
      (input.candidate.sourceMetadata as Record<string, unknown>).externalLocationFromTitle === true;
    if (defaultVenueId && !externalLocationFromTitle) {
      const inCatalog = input.catalog.venues.some((venue) => venue.id === defaultVenueId);
      if (inCatalog) {
        return {
          entityType: 'venue',
          decision: 'matched',
          canonicalId: defaultVenueId,
          confidenceScore: 100,
          candidateIds: [defaultVenueId],
          reasonCodes: ['source_default_venue_id'],
        };
      }
    }

    if (input.externalVenueId) {
      const byExternal = this.aliases.findCanonicalId(
        'venue',
        'external_id',
        input.externalVenueId,
        input.sourceId,
      );
      if (byExternal) {
        return {
          entityType: 'venue',
          decision: 'matched',
          canonicalId: byExternal,
          confidenceScore: 100,
          candidateIds: [byExternal],
          reasonCodes: ['external_id'],
        };
      }
    }

    if (input.websiteUrl) {
      const domain = extractDomain(input.websiteUrl);
      if (domain) {
        const byDomain = this.aliases.findCanonicalId('venue', 'domain', domain);
        if (byDomain) {
          return {
            entityType: 'venue',
            decision: 'matched',
            canonicalId: byDomain,
            confidenceScore: 98,
            candidateIds: [byDomain],
            reasonCodes: ['domain'],
          };
        }
      }
    }

    const nameAlias = input.candidate.venueName
      ? this.aliases.findCanonicalId(
          'venue',
          'normalized_name',
          normalizeIdentityText(input.candidate.venueName),
        )
      : undefined;
    if (nameAlias) {
      return {
        entityType: 'venue',
        decision: 'matched',
        canonicalId: nameAlias,
        confidenceScore: 96,
        candidateIds: [nameAlias],
        reasonCodes: ['manual_alias'],
      };
    }

    const match = venueMatchingService.match(
      input.candidate,
      input.catalog,
      input.matchedCityId,
    );

    if (match.venueId && match.confidenceScore >= MATCH_THRESHOLD) {
      return {
        entityType: 'venue',
        decision: 'matched',
        canonicalId: match.venueId,
        confidenceScore: match.confidenceScore,
        candidateIds: [match.venueId],
        reasonCodes: [match.matchType],
      };
    }

    if (match.venueId && match.confidenceScore >= REVIEW_THRESHOLD) {
      return {
        entityType: 'venue',
        decision: 'review_required',
        canonicalId: match.venueId,
        confidenceScore: match.confidenceScore,
        candidateIds: [match.venueId],
        reasonCodes: ['low_confidence'],
        warning: match.warning,
      };
    }

    return {
      entityType: 'venue',
      decision: 'unmatched',
      confidenceScore: match.confidenceScore,
      candidateIds: [],
      reasonCodes: ['no_match'],
      warning: match.warning,
    };
  }
}
