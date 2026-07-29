import type { EntityResolutionOutcome } from '@/features/entity-resolution/types';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

import type { MatchLogEntry } from './import-matching-service';

export function resolveImportSourceId(candidate: NormalizedEventCandidate): string {
  return candidate.sourceId?.trim() || 'unknown';
}

export function readCandidateMetadataString(
  candidate: NormalizedEventCandidate,
  ...keys: string[]
): string | undefined {
  const metadata = candidate.sourceMetadata;
  if (!metadata) {
    return undefined;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function resolveLinkedEntityId(outcome: EntityResolutionOutcome): string | undefined {
  if (outcome.decision === 'matched' || outcome.decision === 'manual_override') {
    return outcome.canonicalId;
  }

  if (outcome.decision === 'review_required') {
    return outcome.canonicalId;
  }

  return undefined;
}

export function buildEntityMatchLogs(
  entityType: 'venue' | 'organizer' | 'artist',
  outcome: EntityResolutionOutcome,
  label?: string,
): MatchLogEntry[] {
  const prefix = entityType.toUpperCase();
  const nameSuffix = label ? ` "${label}"` : '';

  if (outcome.decision === 'matched' || outcome.decision === 'manual_override') {
    return [
      {
        level: 'info',
        code: `${prefix}_MATCHED`,
        message: `${prefix} matched${nameSuffix} with confidence ${outcome.confidenceScore} (${outcome.reasonCodes.join(', ')}).`,
      },
    ];
  }

  if (outcome.decision === 'review_required') {
    return [
      {
        level: 'warning',
        code: `${prefix}_REVIEW_REQUIRED`,
        message:
          outcome.warning ??
          `${prefix} match${nameSuffix} needs review (confidence ${outcome.confidenceScore}).`,
      },
    ];
  }

  if (outcome.decision === 'keep_separate') {
    return [
      {
        level: 'warning',
        code: `${prefix}_KEEP_SEPARATE`,
        message: `${prefix}${nameSuffix} kept separate by manual decision.`,
      },
    ];
  }

  return [
    {
      level: 'warning',
      code: `${prefix}_MATCH_FAILED`,
      message: outcome.warning ?? `${prefix}${nameSuffix} could not be matched.`,
    },
  ];
}

export function buildEntityMatchWarning(outcome: EntityResolutionOutcome, label: string): string | undefined {
  if (outcome.decision === 'review_required') {
    return outcome.warning ?? `${label} match needs admin review.`;
  }
  if (outcome.decision === 'keep_separate') {
    return `${label} kept separate by manual decision.`;
  }
  if (outcome.decision === 'unmatched') {
    return outcome.warning ?? `No ${label.toLowerCase()} match found.`;
  }
  return undefined;
}
