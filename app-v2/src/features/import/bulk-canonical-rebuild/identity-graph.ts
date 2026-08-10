import type { AdminEventRecord } from '@/data/types/records';
import { analyzeEventTitleCore } from '@/features/import/matching/event-title-core';
import { sameCalendarDay } from '@/features/import/matching/matching-utils';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';
import { evaluateCanonicalIdentityCollision } from '@/features/import/generic-truth-pipeline/canonical-identity-collision';
import { adminEventToIdentitySnapshot } from '@/features/import/generic-truth-pipeline/evidence-from-canonical';

import { assessContributionCollisions } from './contribution-collision';
import type { SourceEvidenceContribution } from './types';

export interface IdentityCluster {
  clusterKey: string;
  eventIdBefore?: string;
  contributionKeys: string[];
  clusterVerdict?: 'secure' | 'review_collision' | 'review_identity' | 'unmapped';
  pairwiseIdentity?: Array<{
    left: string;
    right: string;
    compatible: boolean;
    reason: string;
  }>;
  duplicateProposal?: {
    collisionEventIds: string[];
    reasons: string[];
    mergeBlocked: true;
  };
}

function contributionKey(contribution: SourceEvidenceContribution): string {
  return `${contribution.sourceId}:${contribution.externalId}`;
}

function clusterFingerprint(contribution: SourceEvidenceContribution): string {
  const title =
    contribution.bundle.identity.pageTitle ??
    contribution.bundle.identity.listRowTitle ??
    contribution.candidate.title ??
    '';
  const core = analyzeEventTitleCore(title, {
    venueName: contribution.candidate.venueName,
    organizerName: contribution.candidate.organizerName,
  });
  const day = contribution.candidate.startDate?.slice(0, 10) ?? 'unknown-day';
  const venue = (contribution.candidate.venueName ?? contribution.bundle.identity.venueName ?? '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return `${core.normalizedTitle}|${day}|${venue}`;
}

function contributionsCompatible(
  left: SourceEvidenceContribution,
  right: SourceEvidenceContribution,
): { compatible: boolean; reason: string } {
  if (left.mappedEventId && right.mappedEventId) {
    return {
      compatible: left.mappedEventId === right.mappedEventId,
      reason: left.mappedEventId === right.mappedEventId ? 'same_import_record_event' : 'different_import_records',
    };
  }

  if (left.mappedEventId && !right.mappedEventId) {
    return { compatible: false, reason: 'single_mapped_vs_unmapped' };
  }
  if (!left.mappedEventId && right.mappedEventId) {
    return { compatible: false, reason: 'single_mapped_vs_unmapped' };
  }

  const leftTitle =
    left.bundle.identity.pageTitle ??
    left.bundle.identity.listRowTitle ??
    left.candidate.title ??
    '';
  const rightTitle =
    right.bundle.identity.pageTitle ??
    right.bundle.identity.listRowTitle ??
    right.candidate.title ??
    '';
  const leftCore = analyzeEventTitleCore(leftTitle, {
    venueName: left.candidate.venueName,
    organizerName: left.candidate.organizerName,
  });
  const rightCore = analyzeEventTitleCore(rightTitle, {
    venueName: right.candidate.venueName,
    organizerName: right.candidate.organizerName,
  });

  if (leftCore.normalizedTitle !== rightCore.normalizedTitle) {
    return { compatible: false, reason: 'title_core_differs' };
  }
  if (
    left.candidate.startDate &&
    right.candidate.startDate &&
    !sameCalendarDay(left.candidate.startDate, right.candidate.startDate)
  ) {
    return { compatible: false, reason: 'calendar_day_differs' };
  }
  if (!venueCompatible(left.candidate.venueName, right.candidate.venueName)) {
    return { compatible: false, reason: 'venue_incompatible' };
  }
  return { compatible: true, reason: 'public_identity_compatible' };
}

function mergeClusterMembers(
  seed: SourceEvidenceContribution,
  pool: SourceEvidenceContribution[],
  assigned: Set<string>,
): { members: SourceEvidenceContribution[]; pairwise: IdentityCluster['pairwiseIdentity'] } {
  const members = [seed];
  const pairwise: IdentityCluster['pairwiseIdentity'] = [];
  assigned.add(contributionKey(seed));

  for (const other of pool) {
    const otherKey = contributionKey(other);
    if (assigned.has(otherKey)) continue;
    const compatibility = contributionsCompatible(seed, other);
    pairwise.push({
      left: contributionKey(seed),
      right: otherKey,
      compatible: compatibility.compatible,
      reason: compatibility.reason,
    });
    if (compatibility.compatible) {
      members.push(other);
      assigned.add(otherKey);
      for (const member of members) {
        if (contributionKey(member) === otherKey) continue;
        const nested = contributionsCompatible(member, other);
        pairwise.push({
          left: contributionKey(member),
          right: otherKey,
          compatible: nested.compatible,
          reason: nested.reason,
        });
      }
    }
  }

  return { members, pairwise };
}

export function buildIdentityClusters(
  contributions: SourceEvidenceContribution[],
  existingEvents: AdminEventRecord[],
): IdentityCluster[] {
  const clusters: IdentityCluster[] = [];
  const assigned = new Set<string>();

  const byMappedEventId = new Map<string, SourceEvidenceContribution[]>();
  for (const contribution of contributions) {
    if (!contribution.mappedEventId) continue;
    const list = byMappedEventId.get(contribution.mappedEventId) ?? [];
    list.push(contribution);
    byMappedEventId.set(contribution.mappedEventId, list);
  }

  for (const [eventId, mappedContributions] of byMappedEventId) {
    for (const contribution of mappedContributions) {
      assigned.add(contributionKey(contribution));
    }
    const cluster: IdentityCluster = {
      clusterKey: `mapped:${eventId}`,
      eventIdBefore: eventId,
      contributionKeys: mappedContributions.map(contributionKey),
      clusterVerdict: 'secure',
      pairwiseIdentity: [],
    };
    clusters.push(cluster);
  }

  for (const contribution of contributions) {
    const key = contributionKey(contribution);
    if (assigned.has(key)) continue;

    const { members, pairwise } = mergeClusterMembers(contribution, contributions, assigned);
    const mappedIds = [...new Set(members.map((m) => m.mappedEventId).filter((id): id is string => Boolean(id)))];
    const eventIdBefore =
      mappedIds.length === 1 ? mappedIds[0] : mappedIds.length > 1 ? undefined : members[0]?.mappedEventId;

    clusters.push({
      clusterKey: clusterFingerprint(contribution),
      eventIdBefore,
      contributionKeys: members.map(contributionKey),
      clusterVerdict: eventIdBefore ? 'secure' : 'unmapped',
      pairwiseIdentity: pairwise,
      ...(mappedIds.length > 1
        ? {
            duplicateProposal: {
              collisionEventIds: mappedIds,
              reasons: ['multiple_import_record_mappings'],
              mergeBlocked: true as const,
            },
          }
        : {}),
    });
  }

  for (const cluster of clusters) {
    const members = contributions.filter((c) => cluster.contributionKeys.includes(contributionKey(c)));
    for (const candidate of contributions) {
      const key = contributionKey(candidate);
      if (cluster.contributionKeys.includes(key)) continue;
      if (members.some((member) => contributionsCompatible(member, candidate).compatible)) {
        cluster.contributionKeys.push(key);
        members.push(candidate);
        assigned.add(key);
      }
    }
  }

  for (const cluster of clusters) {
    for (const key of cluster.contributionKeys) {
      assigned.add(key);
    }
  }

  const collisionCatalog = existingEvents.map((event) => adminEventToIdentitySnapshot(event));
  for (const cluster of clusters) {
    const members = contributions.filter((c) => cluster.contributionKeys.includes(contributionKey(c)));
    const existing = cluster.eventIdBefore
      ? existingEvents.find((event) => event.id === cluster.eventIdBefore)
      : undefined;
    const collisionAssessment = assessContributionCollisions(members, existing);

    if (collisionAssessment.hasCollision || collisionAssessment.hasContamination) {
      cluster.clusterVerdict = 'review_collision';
      cluster.duplicateProposal = {
        collisionEventIds: existing ? [existing.id] : cluster.duplicateProposal?.collisionEventIds ?? [],
        reasons: collisionAssessment.reasons,
        mergeBlocked: true,
      };
    }

    if (existing) {
      const catalogCollision = evaluateCanonicalIdentityCollision(
        adminEventToIdentitySnapshot(existing),
        collisionCatalog,
      );
      if (catalogCollision.verdict === 'collision_review_required') {
        cluster.clusterVerdict = 'review_collision';
        cluster.duplicateProposal = {
          collisionEventIds: catalogCollision.collisionEventIds,
          reasons: [...(cluster.duplicateProposal?.reasons ?? []), ...catalogCollision.reasons],
          mergeBlocked: true,
        };
      }
    }
  }

  return clusters;
}

export function contributionsForCluster(
  cluster: IdentityCluster,
  allContributions: SourceEvidenceContribution[],
): SourceEvidenceContribution[] {
  const byKey = new Map(allContributions.map((c) => [contributionKey(c), c]));
  return cluster.contributionKeys
    .map((key) => byKey.get(key))
    .filter((entry): entry is SourceEvidenceContribution => Boolean(entry));
}
