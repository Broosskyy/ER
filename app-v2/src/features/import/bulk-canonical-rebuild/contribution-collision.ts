import type { AdminEventRecord } from '@/data/types/records';
import { analyzeEventTitleCore } from '@/features/import/matching/event-title-core';

import type { SourceEvidenceContribution } from './types';

export interface ContributionCollisionAssessment {
  hasCollision: boolean;
  hasContamination: boolean;
  collisionContributionKeys: string[];
  reasons: string[];
}

function contributionKey(contribution: SourceEvidenceContribution): string {
  return `${contribution.sourceId}:${contribution.externalId}`;
}

export function assessContributionCollisions(
  contributions: SourceEvidenceContribution[],
  existing?: AdminEventRecord,
): ContributionCollisionAssessment {
  const reasons: string[] = [];
  const collisionContributionKeys: string[] = [];
  let hasContamination = false;

  for (const contribution of contributions) {
    const meta = (contribution.candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
    if (contribution.bundle.contamination?.detected || meta.identityEvidenceConflict) {
      hasContamination = true;
      reasons.push(`contamination:${contribution.sourceId}`);
    }

    if (
      contribution.mappedEventId &&
      existing &&
      (contribution.identityVerdict === 'mismatch' ||
        contribution.identityVerdict === 'unverifiable')
    ) {
      collisionContributionKeys.push(contributionKey(contribution));
      reasons.push(`import_mapping_identity_mismatch:${contribution.sourceId}`);
    }

    const evidenceTitle =
      contribution.bundle.identity.pageTitle ??
      contribution.bundle.identity.listRowTitle;
    if (
      contribution.mappedEventId &&
      existing &&
      evidenceTitle &&
      contribution.identityVerdict !== 'exact' &&
      contribution.identityVerdict !== 'corroborated'
    ) {
      const existingCore = analyzeEventTitleCore(existing.title, {
        venueName: existing.venueName,
        organizerName: existing.organizerName,
      });
      const evidenceCore = analyzeEventTitleCore(evidenceTitle, {
        venueName: contribution.bundle.identity.venueName ?? contribution.candidate.venueName,
        organizerName: contribution.candidate.organizerName,
      });
      if (
        existingCore.normalizedTitle &&
        evidenceCore.normalizedTitle &&
        existingCore.normalizedTitle !== evidenceCore.normalizedTitle
      ) {
        if (!collisionContributionKeys.includes(contributionKey(contribution))) {
          collisionContributionKeys.push(contributionKey(contribution));
        }
        reasons.push(`title_core_mismatch:${contribution.sourceId}`);
      }
    }
  }

  const mappedIds = [...new Set(contributions.map((c) => c.mappedEventId).filter(Boolean))];
  if (mappedIds.length > 1) {
    reasons.push('multiple_import_record_event_ids');
  }

  return {
    hasCollision: collisionContributionKeys.length > 0 || mappedIds.length > 1,
    hasContamination,
    collisionContributionKeys,
    reasons: [...new Set(reasons)],
  };
}

export function isTicketContributionBlocked(
  contribution: SourceEvidenceContribution,
  collisionKeys: string[],
): boolean {
  const key = contributionKey(contribution);
  return collisionKeys.includes(key) || contribution.bundle.contamination?.detected === true;
}
