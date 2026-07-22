import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { matchingConfig } from '@/features/import/matching/matching-config';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import { normalizeMatchText, tokenSimilarity } from '@/features/import/matching/matching-utils';
import {
  GENERIC_ORGANIZER_NAMES,
  isGenericOrganizerName,
} from '@/features/organizers/domain/organizer-duplicate';

export type OrganizerMatchType = 'matched' | 'unmatched' | 'ambiguous' | 'invalid';

export interface OrganizerMatchOutcome {
  organizerId?: string;
  matchType: OrganizerMatchType;
  confidenceScore: number;
  candidateIds: string[];
  warning?: string;
}

export class OrganizerMatchingService {
  match(candidate: NormalizedEventCandidate, catalog: MatchingCatalog): OrganizerMatchOutcome {
    const organizerName = candidate.organizerName?.trim();
    if (!organizerName) {
      return { matchType: 'unmatched', confidenceScore: 0, candidateIds: [] };
    }

    if (isGenericOrganizerName(organizerName)) {
      return {
        matchType: 'invalid',
        confidenceScore: 0,
        candidateIds: [],
        warning: `Organizer "${organizerName}" is too generic to match.`,
      };
    }

    const normalizedName = normalizeMatchText(organizerName);
    const scored = catalog.organizers
      .map((organizer) => ({
        organizer,
        score: tokenSimilarity(organizerName, organizer.name),
      }))
      .filter((entry) => entry.score >= matchingConfig.minOrganizerConfidence)
      .sort((left, right) => right.score - left.score);

    if (scored.length === 0) {
      return {
        matchType: 'unmatched',
        confidenceScore: 0,
        candidateIds: [],
        warning: `No organizer match found for "${organizerName}".`,
      };
    }

    const top = scored[0];
    if (!top) {
      return {
        matchType: 'unmatched',
        confidenceScore: 0,
        candidateIds: [],
        warning: `No organizer match found for "${organizerName}".`,
      };
    }

    const exactNameMatches = scored.filter(
      (entry) => normalizeMatchText(entry.organizer.name) === normalizedName,
    );

    if (exactNameMatches.length > 1) {
      return {
        matchType: 'ambiguous',
        confidenceScore: top.score,
        candidateIds: exactNameMatches.map((entry) => entry.organizer.id),
        warning: `Multiple organizers match "${organizerName}".`,
      };
    }

    if (top.score >= 95) {
      return {
        organizerId: top.organizer.id,
        matchType: 'matched',
        confidenceScore: top.score,
        candidateIds: [top.organizer.id],
      };
    }

    if (top.score >= matchingConfig.minOrganizerConfidence) {
      return {
        organizerId: top.organizer.id,
        matchType: 'matched',
        confidenceScore: top.score,
        candidateIds: [top.organizer.id],
        warning: `Probable organizer match for "${organizerName}" (${top.score}%).`,
      };
    }

    return {
      matchType: 'unmatched',
      confidenceScore: top.score,
      candidateIds: [],
      warning: `No organizer match found for "${organizerName}".`,
    };
  }
}

export const organizerMatchingService = new OrganizerMatchingService();

export { GENERIC_ORGANIZER_NAMES };
