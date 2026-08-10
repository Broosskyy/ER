import type { AdminEventRecord } from '@/data/types/records';
import { analyzeEventTitleCore } from '@/features/import/matching/event-title-core';
import { sameCalendarDay } from '@/features/import/matching/matching-utils';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';

import type { SourceEvidenceContribution } from './types';

export type CollisionTriageType =
  | 'hard_identity_conflict'
  | 'stale_import_linkage'
  | 'duplicate_candidate'
  | 'insufficient_evidence'
  | 'field_level_conflict'
  | 'none';

export interface ContributionTriageEntry {
  contributionKey: string;
  triageType: CollisionTriageType;
  reason: string;
  isolate: boolean;
  blockTicketFields: boolean;
  blockContentFields: boolean;
  suggestedReassignmentEventId?: string;
}

export interface CollisionTriageResult {
  clusterCollision: boolean;
  isolatedContributionKeys: string[];
  triageEntries: ContributionTriageEntry[];
  triageByContribution: Record<string, CollisionTriageType>;
  reassignmentSuggestions: Array<{ contributionKey: string; suggestedEventId: string; reason: string }>;
  reasons: string[];
  secureContributionCount: number;
}

function contributionKey(contribution: SourceEvidenceContribution): string {
  return `${contribution.sourceId}:${contribution.externalId}`;
}

function evidenceTitle(contribution: SourceEvidenceContribution): string {
  return (
    contribution.bundle.identity.pageTitle ??
    contribution.bundle.identity.listRowTitle ??
    contribution.candidate.title ??
    ''
  );
}

function evidenceDay(contribution: SourceEvidenceContribution): string | undefined {
  return (
    contribution.bundle.identity.eventDate ??
    contribution.candidate.startDate?.slice(0, 10)
  );
}

function evidenceVenue(contribution: SourceEvidenceContribution): string | undefined {
  return contribution.bundle.identity.venueName ?? contribution.candidate.venueName;
}

function isStrongIdentity(contribution: SourceEvidenceContribution): boolean {
  return (
    contribution.identityVerdict === 'exact' ||
    contribution.identityVerdict === 'corroborated' ||
    Boolean(contribution.bundle.identity.pageTitle && contribution.bundle.identity.eventDate)
  );
}

function titleCoreConflict(
  leftTitle: string,
  rightTitle: string,
  leftVenue?: string,
  rightVenue?: string,
  leftOrganizer?: string,
  rightOrganizer?: string,
): boolean {
  const leftCore = analyzeEventTitleCore(leftTitle, { venueName: leftVenue, organizerName: leftOrganizer });
  const rightCore = analyzeEventTitleCore(rightTitle, { venueName: rightVenue, organizerName: rightOrganizer });
  if (!leftCore.normalizedTitle || !rightCore.normalizedTitle) return false;
  return leftCore.normalizedTitle !== rightCore.normalizedTitle;
}

export function triageClusterCollisions(
  contributions: SourceEvidenceContribution[],
  existing?: AdminEventRecord,
): CollisionTriageResult {
  const triageEntries: ContributionTriageEntry[] = [];
  const reasons: string[] = [];
  const reassignmentSuggestions: Array<{
    contributionKey: string;
    suggestedEventId: string;
    reason: string;
  }> = [];

  const mappedIds = [...new Set(contributions.map((c) => c.mappedEventId).filter(Boolean))];
  if (mappedIds.length > 1) {
    reasons.push('multiple_import_record_event_ids');
  }

  for (const contribution of contributions) {
    const key = contributionKey(contribution);
    const meta = (contribution.candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};

    if (contribution.bundle.contamination?.detected || meta.identityEvidenceConflict) {
      triageEntries.push({
        contributionKey: key,
        triageType: 'hard_identity_conflict',
        reason: 'contamination_detected',
        isolate: true,
        blockTicketFields: true,
        blockContentFields: true,
      });
      continue;
    }

    if (
      contribution.mappedEventId &&
      existing &&
      contribution.identityVerdict === 'mismatch'
    ) {
      const otherStrong = contributions.filter(
        (c) =>
          c !== contribution &&
          c.mappedEventId === contribution.mappedEventId &&
          (c.identityVerdict === 'exact' || c.identityVerdict === 'corroborated'),
      );
      if (otherStrong.length > 0) {
        triageEntries.push({
          contributionKey: key,
          triageType: 'stale_import_linkage',
          reason: 'import_mapping_identity_mismatch_with_secure_peers',
          isolate: true,
          blockTicketFields: true,
          blockContentFields: true,
        });
        continue;
      }
      triageEntries.push({
        contributionKey: key,
        triageType: 'hard_identity_conflict',
        reason: 'import_mapping_identity_mismatch',
        isolate: true,
        blockTicketFields: true,
        blockContentFields: true,
      });
      continue;
    }

    if (
      contribution.mappedEventId &&
      existing &&
      contribution.identityVerdict !== 'exact' &&
      contribution.identityVerdict !== 'corroborated'
    ) {
      const evTitle = evidenceTitle(contribution);
      if (
        evTitle &&
        titleCoreConflict(
          evTitle,
          existing.title,
          evidenceVenue(contribution),
          existing.venueName,
          contribution.candidate.organizerName,
          existing.organizerName,
        )
      ) {
        const peersAgree = contributions.some(
          (c) =>
            c !== contribution &&
            c.mappedEventId === contribution.mappedEventId &&
            !titleCoreConflict(
              evidenceTitle(c),
              existing.title,
              evidenceVenue(c),
              existing.venueName,
              c.candidate.organizerName,
              existing.organizerName,
            ),
        );
        triageEntries.push({
          contributionKey: key,
          triageType: peersAgree ? 'stale_import_linkage' : 'hard_identity_conflict',
          reason: peersAgree ? 'title_core_mismatch_stale_linkage' : 'title_core_mismatch',
          isolate: true,
          blockTicketFields: true,
          blockContentFields: peersAgree ? true : true,
        });
        continue;
      }
    }

    if (
      contribution.identityVerdict === 'unverifiable' ||
      contribution.identityVerdict === 'partial_review_only'
    ) {
      triageEntries.push({
        contributionKey: key,
        triageType: 'insufficient_evidence',
        reason: contribution.identityReason,
        isolate: false,
        blockTicketFields: false,
        blockContentFields: true,
      });
      continue;
    }

    triageEntries.push({
      contributionKey: key,
      triageType: 'duplicate_candidate',
      reason: 'compatible_identity',
      isolate: false,
      blockTicketFields: false,
      blockContentFields: false,
    });
  }

  for (let i = 0; i < contributions.length; i += 1) {
    for (let j = i + 1; j < contributions.length; j += 1) {
      const left = contributions[i]!;
      const right = contributions[j]!;
      const leftTitle = evidenceTitle(left);
      const rightTitle = evidenceTitle(right);
      const leftDay = evidenceDay(left);
      const rightDay = evidenceDay(right);
      const leftVenue = evidenceVenue(left);
      const rightVenue = evidenceVenue(right);

      const titleConflict = titleCoreConflict(
        leftTitle,
        rightTitle,
        leftVenue,
        rightVenue,
        left.candidate.organizerName,
        right.candidate.organizerName,
      );
      const dayConflict =
        leftDay && rightDay && !sameCalendarDay(leftDay, rightDay);
      const venueConflict =
        leftVenue && rightVenue && !venueCompatible(leftVenue, rightVenue);

      if (titleConflict && dayConflict) {
        for (const contribution of [left, right]) {
          if (existing) {
            const matchesExisting = !titleCoreConflict(
              evidenceTitle(contribution),
              existing.title,
              evidenceVenue(contribution),
              existing.venueName,
              contribution.candidate.organizerName,
              existing.organizerName,
            );
            if (matchesExisting) {
              continue;
            }
          }

          const key = contributionKey(contribution);
          const existingEntry = triageEntries.find((e) => e.contributionKey === key);
          if (existingEntry) {
            const triageType =
              existing && contribution.identityVerdict === 'mismatch'
                ? 'stale_import_linkage'
                : 'hard_identity_conflict';
            existingEntry.triageType = triageType;
            existingEntry.isolate = true;
            existingEntry.blockTicketFields = true;
            existingEntry.blockContentFields = true;
            existingEntry.reason = 'cross_contribution_title_day_conflict';
          }
        }
        reasons.push('hard_identity_conflict_pair');
      } else if (venueConflict && !titleConflict && leftDay && rightDay && sameCalendarDay(leftDay, rightDay)) {
        for (const contribution of [left, right]) {
          const key = contributionKey(contribution);
          const entry = triageEntries.find((e) => e.contributionKey === key);
          if (entry && entry.triageType === 'duplicate_candidate') {
            entry.triageType = 'field_level_conflict';
            entry.blockContentFields = true;
            entry.reason = 'venue_field_conflict';
          }
        }
        reasons.push('field_level_venue_conflict');
      }
    }
  }

  const isolatedContributionKeys = triageEntries
    .filter((entry) => entry.isolate)
    .map((entry) => entry.contributionKey);

  const secureContributionCount = triageEntries.filter(
    (entry) =>
      !entry.isolate &&
      entry.triageType === 'duplicate_candidate' &&
      !entry.blockTicketFields,
  ).length;

  const hardConflicts = triageEntries.filter(
    (e) => e.triageType === 'hard_identity_conflict' && !e.isolate,
  ).length;
  const remainingStrong = contributions.filter(
    (c) =>
      !isolatedContributionKeys.includes(contributionKey(c)) &&
      isStrongIdentity(c),
  );

  const clusterCollision =
    hardConflicts > 0 ||
    (remainingStrong.length > 1 &&
      triageEntries.some((e) => e.triageType === 'hard_identity_conflict')) ||
    (secureContributionCount === 0 && contributions.length > 0 && isolatedContributionKeys.length === contributions.length);

  const triageByContribution: Record<string, CollisionTriageType> = {};
  for (const entry of triageEntries) {
    triageByContribution[entry.contributionKey] = entry.triageType;
  }

  for (const entry of triageEntries) {
    if (entry.triageType === 'stale_import_linkage' && existing) {
      reassignmentSuggestions.push({
        contributionKey: entry.contributionKey,
        suggestedEventId: 'unassigned_public_match_required',
        reason: entry.reason,
      });
    }
  }

  return {
    clusterCollision,
    isolatedContributionKeys,
    triageEntries,
    triageByContribution,
    reassignmentSuggestions,
    reasons: [...new Set(reasons)],
    secureContributionCount,
  };
}

export function blockedContributionKeysFromTriage(triage: CollisionTriageResult): string[] {
  return triage.triageEntries
    .filter((entry) => entry.blockTicketFields || entry.isolate)
    .map((entry) => entry.contributionKey);
}

export function contentBlockedContributionKeysFromTriage(triage: CollisionTriageResult): string[] {
  return triage.triageEntries
    .filter((entry) => entry.blockContentFields || entry.isolate)
    .map((entry) => entry.contributionKey);
}
