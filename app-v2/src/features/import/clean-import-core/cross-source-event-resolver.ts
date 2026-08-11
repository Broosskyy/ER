import { resolveOfficialOutboundRelationship } from '@/features/import/domain/official-page-ticket-corroboration';

import type { EventEvidence } from './event-evidence';
import { evaluateSourceNativeIdentityCompatibility } from './identity-resolver';

export interface ResolvableEventContribution {
  contributionId: string;
  externalId: string;
  evidence: EventEvidence;
}

export interface ResolvedEventCluster {
  clusterId: string;
  contributionIds: string[];
  contributions: ResolvableEventContribution[];
  diagnostics: string[];
}

export interface CrossSourceResolution {
  clusters: ResolvedEventCluster[];
  diagnostics: string[];
}

type PairResolution =
  | { relation: 'compatible'; reason: string }
  | { relation: 'conflict'; reason: string }
  | { relation: 'unrelated'; reason: string };

function normalizePublicUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function publicUrls(evidence: EventEvidence): Set<string> {
  return new Set(
    [
      evidence.sourceUrl,
      evidence.finalSourceUrl,
      evidence.identity.officialWebsiteUrl?.value,
      evidence.tickets.publicTicketUrl?.value,
      evidence.tickets.checkoutEvidenceUrl?.value,
      ...evidence.identity.outboundTicketUrls,
    ]
      .map(normalizePublicUrl)
      .filter((value): value is string => Boolean(value)),
  );
}

function evidenceIdentity(evidence: EventEvidence) {
  return {
    title: evidence.identity.title?.value,
    startDate: evidence.identity.startDate?.value,
    venueName: evidence.identity.venueName?.value,
    locationText: evidence.identity.locationText?.value,
  };
}

function hasSharedPublicUrl(left: EventEvidence, right: EventEvidence): boolean {
  const rightUrls = publicUrls(right);
  return [...publicUrls(left)].some((url) => rightUrls.has(url));
}

function hasConfirmedOutboundRelationship(left: EventEvidence, right: EventEvidence): boolean {
  const pairs = [
    [left, right],
    [right, left],
  ] as const;
  return pairs.some(([official, ticket]) => {
    if (
      official.sourceFamily !== 'official_website' ||
      ticket.sourceFamily === 'official_website'
    ) {
      return false;
    }
    return resolveOfficialOutboundRelationship({
      publicTicketPageUrl: ticket.tickets.publicTicketUrl?.value,
      outboundTicketUrls: official.identity.outboundTicketUrls,
    }).confirmed;
  });
}

function resolvePair(
  left: ResolvableEventContribution,
  right: ResolvableEventContribution,
): PairResolution {
  const compatibility = evaluateSourceNativeIdentityCompatibility(
    evidenceIdentity(left.evidence),
    evidenceIdentity(right.evidence),
  );
  const hardConflict = compatibility.reasons.find((reason) =>
    ['title_mismatch', 'date_mismatch', 'venue_mismatch'].includes(reason),
  );
  if (hardConflict) {
    return {
      relation: 'conflict',
      reason: `${hardConflict}:${left.contributionId}:${right.contributionId}`,
    };
  }
  if (hasSharedPublicUrl(left.evidence, right.evidence)) {
    return { relation: 'compatible', reason: 'shared_public_url' };
  }
  if (hasConfirmedOutboundRelationship(left.evidence, right.evidence)) {
    return { relation: 'compatible', reason: 'official_outbound_ticket_link' };
  }
  if (compatibility.compatible) {
    return {
      relation: 'compatible',
      reason: 'title_day_venue_compatible',
    };
  }
  if (left.evidence.sourceId === right.evidence.sourceId && left.externalId === right.externalId) {
    return { relation: 'compatible', reason: 'same_source_identity' };
  }
  return {
    relation: 'unrelated',
    reason: `insufficient_public_identity:${left.contributionId}:${right.contributionId}`,
  };
}

function canJoinCluster(
  candidate: ResolvableEventContribution,
  cluster: ResolvableEventContribution[],
): { join: boolean; reasons: string[]; conflicts: string[] } {
  const pairs = cluster.map((member) => resolvePair(candidate, member));
  return {
    join:
      pairs.some((pair) => pair.relation === 'compatible') &&
      pairs.every((pair) => pair.relation !== 'conflict'),
    reasons: pairs.filter((pair) => pair.relation === 'compatible').map((pair) => pair.reason),
    conflicts: pairs.filter((pair) => pair.relation === 'conflict').map((pair) => pair.reason),
  };
}

/** Deterministic complete-link clustering; mapped canonical IDs are never inputs. */
export class CrossSourceEventResolver {
  resolve(contributions: ResolvableEventContribution[]): CrossSourceResolution {
    const ordered = [...contributions].sort((left, right) =>
      left.contributionId.localeCompare(right.contributionId),
    );
    const groups: Array<{
      contributions: ResolvableEventContribution[];
      diagnostics: string[];
    }> = [];
    const diagnostics: string[] = [];

    for (const contribution of ordered) {
      const candidates = groups
        .map((group, index) => ({
          index,
          group,
          resolution: canJoinCluster(contribution, group.contributions),
        }))
        .filter((entry) => entry.resolution.join);
      const selected = candidates[0];
      if (!selected) {
        for (const group of groups) {
          const conflicts = canJoinCluster(contribution, group.contributions).conflicts;
          diagnostics.push(...conflicts);
        }
        groups.push({ contributions: [contribution], diagnostics: [] });
        continue;
      }
      selected.group.contributions.push(contribution);
      selected.group.diagnostics.push(...selected.resolution.reasons);
    }

    const clusters = groups
      .map((group) => {
        const sorted = [...group.contributions].sort((left, right) =>
          left.contributionId.localeCompare(right.contributionId),
        );
        const contributionIds = sorted.map((entry) => entry.contributionId);
        return {
          clusterId: `cluster:${contributionIds.join('|')}`,
          contributionIds,
          contributions: sorted,
          diagnostics: [...new Set(group.diagnostics)].sort(),
        };
      })
      .sort((left, right) => left.clusterId.localeCompare(right.clusterId));

    return {
      clusters,
      diagnostics: [...new Set(diagnostics)].sort(),
    };
  }
}
