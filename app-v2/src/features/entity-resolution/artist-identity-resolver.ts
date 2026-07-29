import type { MatchingCatalog } from '@/features/import/matching/match-result';
import { artistMatchingService } from '@/features/import/matching/artist-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

import {
  buildEntityCandidateKey,
  normalizeIdentityText,
} from './entity-alias-store';
import type { EntityAliasStore, EntityResolutionOutcome } from './types';

const REVIEW_THRESHOLD = 80;
const MATCH_THRESHOLD = 95;

export interface ArtistIdentityInput {
  candidate: NormalizedEventCandidate;
  catalog: MatchingCatalog;
  sourceId: string;
  externalArtistId?: string;
  profileUrl?: string;
  socialHandle?: string;
}

export class ArtistIdentityResolver {
  constructor(private readonly aliases: EntityAliasStore) {}

  resolveOne(input: ArtistIdentityInput, artistName: string): EntityResolutionOutcome {
    const candidateKey = buildEntityCandidateKey({
      sourceId: input.sourceId,
      externalId: input.externalArtistId,
      name: artistName,
      url: input.profileUrl,
      handle: input.socialHandle,
    });

    const manual = this.aliases.getDecision('artist', candidateKey);
    if (manual?.decision === 'keep_separate') {
      return {
        entityType: 'artist',
        decision: 'keep_separate',
        canonicalId: manual.canonicalId,
        confidenceScore: 100,
        candidateIds: manual.canonicalId ? [manual.canonicalId] : [],
        reasonCodes: ['manual_keep_separate'],
      };
    }
    if (manual?.decision === 'manual_override' && manual.canonicalId) {
      return {
        entityType: 'artist',
        decision: 'manual_override',
        canonicalId: manual.canonicalId,
        confidenceScore: 100,
        candidateIds: [manual.canonicalId],
        reasonCodes: ['manual_override'],
      };
    }

    if (input.externalArtistId) {
      const byExternal = this.aliases.findCanonicalId(
        'artist',
        'external_id',
        input.externalArtistId,
        input.sourceId,
      );
      if (byExternal) {
        return {
          entityType: 'artist',
          decision: 'matched',
          canonicalId: byExternal,
          confidenceScore: 100,
          candidateIds: [byExternal],
          reasonCodes: ['external_id'],
        };
      }
    }

    const aliasMatch = this.aliases.findCanonicalId(
      'artist',
      'normalized_name',
      normalizeIdentityText(artistName),
    );
    if (aliasMatch) {
      return {
        entityType: 'artist',
        decision: 'matched',
        canonicalId: aliasMatch,
        confidenceScore: 96,
        candidateIds: [aliasMatch],
        reasonCodes: ['manual_alias'],
      };
    }

    const singleCandidate: NormalizedEventCandidate = {
      ...input.candidate,
      artistNames: [artistName],
    };
    const matches = artistMatchingService.match(singleCandidate, input.catalog);
    const match = matches[0];

    if (!match) {
      return {
        entityType: 'artist',
        decision: 'unmatched',
        confidenceScore: 0,
        candidateIds: [],
        reasonCodes: ['no_match'],
      };
    }

    if (match.artistId && match.confidenceScore >= MATCH_THRESHOLD) {
      return {
        entityType: 'artist',
        decision: 'matched',
        canonicalId: match.artistId,
        confidenceScore: match.confidenceScore,
        candidateIds: [match.artistId],
        reasonCodes: [match.matchType],
      };
    }

    if (match.artistId && match.confidenceScore >= REVIEW_THRESHOLD) {
      return {
        entityType: 'artist',
        decision: 'review_required',
        canonicalId: match.artistId,
        confidenceScore: match.confidenceScore,
        candidateIds: [match.artistId],
        reasonCodes: ['low_confidence'],
      };
    }

    return {
      entityType: 'artist',
      decision: 'unmatched',
      confidenceScore: match.confidenceScore,
      candidateIds: [],
      reasonCodes: ['no_match'],
    };
  }

  resolveAll(input: ArtistIdentityInput): EntityResolutionOutcome[] {
    const names = input.candidate.artistNames ?? [];
    return names.map((artistName) => this.resolveOne(input, artistName));
  }
}
