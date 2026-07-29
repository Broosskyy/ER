import type { MatchingCatalog } from '@/features/import/matching/match-result';
import { organizerMatchingService } from '@/features/import/matching/organizer-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

import {
  buildEntityCandidateKey,
  extractDomain,
  normalizeIdentityText,
} from './entity-alias-store';
import type { EntityAliasStore, EntityResolutionOutcome } from './types';

const REVIEW_THRESHOLD = 80;
const MATCH_THRESHOLD = 95;

export interface OrganizerIdentityInput {
  candidate: NormalizedEventCandidate;
  catalog: MatchingCatalog;
  sourceId: string;
  externalOrganizerId?: string;
  officialUrl?: string;
  socialHandle?: string;
}

export class OrganizerIdentityResolver {
  constructor(private readonly aliases: EntityAliasStore) {}

  resolve(input: OrganizerIdentityInput): EntityResolutionOutcome {
    const candidateKey = buildEntityCandidateKey({
      sourceId: input.sourceId,
      externalId: input.externalOrganizerId,
      name: input.candidate.organizerName,
      url: input.officialUrl,
      handle: input.socialHandle,
    });

    const manual = this.aliases.getDecision('organizer', candidateKey);
    if (manual?.decision === 'keep_separate') {
      return {
        entityType: 'organizer',
        decision: 'keep_separate',
        canonicalId: manual.canonicalId,
        confidenceScore: 100,
        candidateIds: manual.canonicalId ? [manual.canonicalId] : [],
        reasonCodes: ['manual_keep_separate'],
      };
    }
    if (manual?.decision === 'manual_override' && manual.canonicalId) {
      return {
        entityType: 'organizer',
        decision: 'manual_override',
        canonicalId: manual.canonicalId,
        confidenceScore: 100,
        candidateIds: [manual.canonicalId],
        reasonCodes: ['manual_override'],
      };
    }

    if (input.externalOrganizerId) {
      const byExternal = this.aliases.findCanonicalId(
        'organizer',
        'external_id',
        input.externalOrganizerId,
        input.sourceId,
      );
      if (byExternal) {
        return {
          entityType: 'organizer',
          decision: 'matched',
          canonicalId: byExternal,
          confidenceScore: 100,
          candidateIds: [byExternal],
          reasonCodes: ['external_id'],
        };
      }
    }

    if (input.officialUrl) {
      const domain = extractDomain(input.officialUrl);
      if (domain) {
        const byDomain = this.aliases.findCanonicalId('organizer', 'domain', domain);
        if (byDomain) {
          return {
            entityType: 'organizer',
            decision: 'matched',
            canonicalId: byDomain,
            confidenceScore: 98,
            candidateIds: [byDomain],
            reasonCodes: ['domain'],
          };
        }
      }
      const byUrl = this.aliases.findCanonicalId('organizer', 'url', normalizeIdentityText(input.officialUrl));
      if (byUrl) {
        return {
          entityType: 'organizer',
          decision: 'matched',
          canonicalId: byUrl,
          confidenceScore: 97,
          candidateIds: [byUrl],
          reasonCodes: ['url'],
        };
      }
    }

    const match = organizerMatchingService.match(input.candidate, input.catalog);
    if (match.matchType === 'ambiguous') {
      return {
        entityType: 'organizer',
        decision: 'review_required',
        confidenceScore: match.confidenceScore,
        candidateIds: match.candidateIds,
        reasonCodes: ['ambiguous_name'],
        warning: match.warning,
      };
    }

    if (match.organizerId && match.confidenceScore >= MATCH_THRESHOLD) {
      return {
        entityType: 'organizer',
        decision: 'matched',
        canonicalId: match.organizerId,
        confidenceScore: match.confidenceScore,
        candidateIds: match.candidateIds,
        reasonCodes: ['normalized_name'],
      };
    }

    if (match.organizerId && match.confidenceScore >= REVIEW_THRESHOLD) {
      return {
        entityType: 'organizer',
        decision: 'review_required',
        canonicalId: match.organizerId,
        confidenceScore: match.confidenceScore,
        candidateIds: match.candidateIds,
        reasonCodes: ['low_confidence'],
        warning: match.warning,
      };
    }

    return {
      entityType: 'organizer',
      decision: 'unmatched',
      confidenceScore: match.confidenceScore,
      candidateIds: [],
      reasonCodes: ['no_match'],
      warning: match.warning,
    };
  }
}
