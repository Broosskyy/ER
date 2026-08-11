import {
  analyzeEventTitleCore,
  compareEventTitleCores,
} from '@/features/import/matching/event-title-core';
import {
  parseEventCalendarDay,
  sameCalendarDay,
} from '@/features/import/matching/matching-utils';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';

import { CanonicalEventBuilder } from './canonical-event-builder';
import {
  isConcreteEventUrl,
  normalizePublicUrl,
  type ResolvedEventCluster,
  type ResolvableEventContribution,
} from './cross-source-event-resolver';
import type { ConnectorOutput, EventEvidence } from './event-evidence';
import { IdentityResolver } from './identity-resolver';
import type { ImportDraft } from './import-draft';

export type DuplicateUrlReconciliationMode =
  | 'none'
  | 'compatible_merge'
  | 'identity_conflict';

export type DuplicateUrlConflictReason =
  | 'same_public_url_title_conflict'
  | 'same_public_url_date_conflict'
  | 'same_public_url_venue_conflict';

export interface DuplicateUrlIdentitySnapshot {
  clusterId: string;
  sourceIds: string[];
  title?: string;
  localCalendarDay?: string;
  venue?: string;
  identityVerdict: ReturnType<IdentityResolver['resolve']>['verdict'];
  verifiedAt: string[];
  officialUrls: string[];
  ticketUrls: string[];
  contributionCount: number;
  evidenceSnapshots: EventEvidence[];
}

export interface DuplicateUrlGroupDiagnostic {
  normalizedUrl: string;
  clusterIds: string[];
  sourceIds: string[];
  titles: string[];
  localCalendarDays: string[];
  venues: string[];
  identityVerdicts: string[];
  verifiedAt: string[];
  officialUrls: string[];
  ticketUrls: string[];
  contributionCounts: Record<string, number>;
}

export interface ReconciledDraftInput extends ResolvedEventCluster {
  originalClusterIds: string[];
  normalizedConcreteUrls: string[];
  reconciliationMode: DuplicateUrlReconciliationMode;
  conflictReasons: DuplicateUrlConflictReason[];
  identitySnapshots: DuplicateUrlIdentitySnapshot[];
}

export interface DuplicateUrlReconciliationResult {
  draftInputs: ReconciledDraftInput[];
  duplicateUrlGroups: DuplicateUrlGroupDiagnostic[];
  compatibleMergedGroups: number;
  conflictGroups: number;
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}

function localCalendarDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = parseEventCalendarDay(value);
  if (!parsed) return undefined;
  return [
    String(parsed.year).padStart(4, '0'),
    String(parsed.month).padStart(2, '0'),
    String(parsed.day).padStart(2, '0'),
  ].join('-');
}

const NON_EVENT_PATH_SEGMENTS = new Set([
  'app',
  'apps',
  'download',
  'downloads',
  'map',
  'maps',
  'navigation',
  'route',
  'routes',
  'share',
  'social',
  'store',
]);

/**
 * Concrete event identity excludes utility/download destinations. The rule is
 * semantic and provider-independent so app stores and navigation/social links
 * can remain outbound evidence without becoming cluster or persistence keys.
 */
export function isEventIdentityUrl(value: string | undefined): boolean {
  if (!value || !isConcreteEventUrl(value)) return false;
  const normalized = normalizePublicUrl(value);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    const hostLabels = url.hostname.toLowerCase().split(/[.-]/).filter(Boolean);
    if (
      hostLabels.some((label) =>
        ['appstore', 'download', 'downloads', 'navigation', 'playstore', 'social'].includes(
          label,
        ),
      )
    ) {
      return false;
    }
    return !url.pathname
      .toLowerCase()
      .split('/')
      .filter(Boolean)
      .some((segment) => NON_EVENT_PATH_SEGMENTS.has(segment));
  } catch {
    return false;
  }
}

function normalizedConcreteUrls(values: Array<string | undefined>): string[] {
  return dedupe(
    values
      .filter((value): value is string => Boolean(value && isEventIdentityUrl(value)))
      .map(normalizePublicUrl)
      .filter((value): value is string => Boolean(value)),
  ).sort();
}

function primaryEvidenceUrls(evidence: EventEvidence): string[] {
  return normalizedConcreteUrls([
    evidence.sourceUrl,
    evidence.finalSourceUrl,
    evidence.identity.officialWebsiteUrl?.value,
    evidence.tickets.publicTicketUrl?.value,
    evidence.tickets.checkoutEvidenceUrl?.value,
  ]);
}

function outboundEvidenceUrls(evidence: EventEvidence): string[] {
  return normalizedConcreteUrls(evidence.identity.outboundTicketUrls);
}

function clusterPrimaryUrls(cluster: ResolvedEventCluster): string[] {
  return dedupe(
    cluster.contributions.flatMap((contribution) =>
      primaryEvidenceUrls(contribution.evidence),
    ),
  ).sort();
}

function clusterIdentityUrls(
  cluster: ResolvedEventCluster,
  primaryUrlsAcrossRun: Set<string>,
): string[] {
  return dedupe(
    [
      ...clusterPrimaryUrls(cluster),
      ...cluster.contributions.flatMap((contribution) =>
        outboundEvidenceUrls(contribution.evidence).filter((url) =>
          primaryUrlsAcrossRun.has(url),
        ),
      ),
    ],
  ).sort();
}

function snapshot(cluster: ResolvedEventCluster): DuplicateUrlIdentitySnapshot {
  const evidence = cluster.contributions.map((entry) => entry.evidence);
  const resolution = new IdentityResolver().resolve(evidence);
  const canonical = new CanonicalEventBuilder().build(resolution);
  const anchor = resolution.identityAnchor ?? evidence[0];
  const title = canonical?.title ?? anchor?.identity.title?.value;
  const startDate = canonical?.startDate ?? anchor?.identity.startDate?.value;
  const venue =
    canonical?.venueName ??
    canonical?.locationText ??
    anchor?.identity.venueName?.value ??
    anchor?.identity.locationText?.value;
  return {
    clusterId: cluster.clusterId,
    sourceIds: dedupe(evidence.map((entry) => entry.sourceId)).sort(),
    title,
    localCalendarDay: localCalendarDay(startDate),
    venue,
    identityVerdict: resolution.verdict,
    verifiedAt: dedupe(
      evidence
        .map((entry) => entry.verifiedAt)
        .filter((value): value is string => Boolean(value)),
    ).sort(),
    officialUrls: dedupe(
      evidence
        .filter((entry) => entry.sourceFamily === 'official_website')
        .flatMap((entry) => [
          entry.identity.officialWebsiteUrl?.value,
          entry.sourceUrl,
          entry.finalSourceUrl,
        ])
        .filter((value): value is string => Boolean(value)),
    ).sort(),
    ticketUrls: dedupe(
      evidence
        .filter((entry) => entry.sourceFamily !== 'official_website')
        .flatMap((entry) => [
          entry.tickets.publicTicketUrl?.value,
          entry.tickets.checkoutEvidenceUrl?.value,
          entry.sourceUrl,
          entry.finalSourceUrl,
        ])
        .filter((value): value is string => Boolean(value)),
    ).sort(),
    contributionCount: cluster.contributions.length,
    evidenceSnapshots: evidence.map((entry) => structuredClone(entry)),
  };
}

function conflictReasons(
  snapshots: DuplicateUrlIdentitySnapshot[],
): DuplicateUrlConflictReason[] {
  const reasons = new Set<DuplicateUrlConflictReason>();
  for (let leftIndex = 0; leftIndex < snapshots.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < snapshots.length;
      rightIndex += 1
    ) {
      const left = snapshots[leftIndex]!;
      const right = snapshots[rightIndex]!;
      const titleCompatible =
        Boolean(left.title && right.title) &&
        compareEventTitleCores(
          analyzeEventTitleCore(left.title!, { venueName: left.venue }),
          analyzeEventTitleCore(right.title!, { venueName: right.venue }),
        ).coresAgree;
      if (!titleCompatible) reasons.add('same_public_url_title_conflict');
      const dateCompatible =
        Boolean(left.localCalendarDay && right.localCalendarDay) &&
        sameCalendarDay(left.localCalendarDay!, right.localCalendarDay!);
      if (!dateCompatible) reasons.add('same_public_url_date_conflict');
      if (!venueCompatible(left.venue, right.venue)) {
        reasons.add('same_public_url_venue_conflict');
      }
    }
  }
  return [...reasons].sort();
}

function diagnostic(
  url: string,
  clusters: ResolvedEventCluster[],
): DuplicateUrlGroupDiagnostic {
  const snapshots = clusters.map(snapshot);
  return {
    normalizedUrl: url,
    clusterIds: snapshots.map((entry) => entry.clusterId).sort(),
    sourceIds: dedupe(snapshots.flatMap((entry) => entry.sourceIds)).sort(),
    titles: dedupe(
      snapshots
        .map((entry) => entry.title)
        .filter((value): value is string => Boolean(value)),
    ).sort(),
    localCalendarDays: dedupe(
      snapshots
        .map((entry) => entry.localCalendarDay)
        .filter((value): value is string => Boolean(value)),
    ).sort(),
    venues: dedupe(
      snapshots
        .map((entry) => entry.venue)
        .filter((value): value is string => Boolean(value)),
    ).sort(),
    identityVerdicts: dedupe(
      snapshots.map((entry) => entry.identityVerdict),
    ).sort(),
    verifiedAt: dedupe(snapshots.flatMap((entry) => entry.verifiedAt)).sort(),
    officialUrls: dedupe(snapshots.flatMap((entry) => entry.officialUrls)).sort(),
    ticketUrls: dedupe(snapshots.flatMap((entry) => entry.ticketUrls)).sort(),
    contributionCounts: Object.fromEntries(
      snapshots.map((entry) => [entry.clusterId, entry.contributionCount]),
    ),
  };
}

function mergedContributions(
  clusters: ResolvedEventCluster[],
): ResolvableEventContribution[] {
  const byId = new Map<string, ResolvableEventContribution>();
  for (const contribution of clusters
    .flatMap((cluster) => cluster.contributions)
    .sort((left, right) => left.contributionId.localeCompare(right.contributionId))) {
    if (!byId.has(contribution.contributionId)) {
      byId.set(contribution.contributionId, contribution);
    }
  }
  return [...byId.values()];
}

function assertOneInputPerConcreteUrl(inputs: ReconciledDraftInput[]): void {
  const owner = new Map<string, string>();
  for (const input of inputs) {
    for (const url of input.normalizedConcreteUrls) {
      const previous = owner.get(url);
      if (previous && previous !== input.clusterId) {
        throw new Error(`duplicate_url_reconciliation_invariant_failed:${url}`);
      }
      owner.set(url, input.clusterId);
    }
  }
}

/**
 * Reconciles only clusters connected by the same concrete public URL.
 * Other Clean-Core clusters pass through unchanged.
 */
export function reconcileDuplicateUrlClusters(
  clusters: ResolvedEventCluster[],
): DuplicateUrlReconciliationResult {
  const ordered = [...clusters].sort((left, right) =>
    left.clusterId.localeCompare(right.clusterId),
  );
  const parent = ordered.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!;
      current = parent[current]!;
    }
    return current;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const indexesByUrl = new Map<string, number[]>();
  const primaryUrlsAcrossRun = new Set(ordered.flatMap(clusterPrimaryUrls));
  const urlsByClusterId = new Map(
    ordered.map((cluster) => [
      cluster.clusterId,
      clusterIdentityUrls(cluster, primaryUrlsAcrossRun),
    ]),
  );
  ordered.forEach((cluster, index) => {
    for (const url of urlsByClusterId.get(cluster.clusterId) ?? []) {
      indexesByUrl.set(url, [...(indexesByUrl.get(url) ?? []), index]);
    }
  });
  for (const indexes of indexesByUrl.values()) {
    const first = indexes[0];
    if (first === undefined) continue;
    for (const index of indexes.slice(1)) union(first, index);
  }
  const components = new Map<number, ResolvedEventCluster[]>();
  ordered.forEach((cluster, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) ?? []), cluster]);
  });

  const duplicateUrlGroups = [...indexesByUrl.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([url, indexes]) =>
      diagnostic(
        url,
        indexes.map((index) => ordered[index]!),
      ),
    )
    .sort((left, right) => left.normalizedUrl.localeCompare(right.normalizedUrl));
  let compatibleMergedGroups = 0;
  let conflictGroups = 0;
  const draftInputs = [...components.values()].map((component) => {
    const sorted = [...component].sort((left, right) =>
      left.clusterId.localeCompare(right.clusterId),
    );
    const originalClusterIds = sorted.map((cluster) => cluster.clusterId);
    const urls = dedupe(
      sorted.flatMap((cluster) => urlsByClusterId.get(cluster.clusterId) ?? []),
    ).sort();
    const identitySnapshots = sorted.map(snapshot);
    const isDuplicateUrlComponent =
      sorted.length > 1 &&
      urls.some((url) => (indexesByUrl.get(url)?.length ?? 0) > 1);
    const conflicts = isDuplicateUrlComponent
      ? conflictReasons(identitySnapshots)
      : [];
    const reconciliationMode: DuplicateUrlReconciliationMode =
      !isDuplicateUrlComponent
        ? 'none'
        : conflicts.length
          ? 'identity_conflict'
          : 'compatible_merge';
    if (reconciliationMode === 'compatible_merge') compatibleMergedGroups += 1;
    if (reconciliationMode === 'identity_conflict') conflictGroups += 1;
    const contributions = mergedContributions(sorted);
    const contributionIds = contributions.map((entry) => entry.contributionId);
    return {
      clusterId:
        reconciliationMode === 'none'
          ? sorted[0]!.clusterId
          : `cluster:duplicate-url:${originalClusterIds.join('|')}`,
      contributionIds,
      contributions,
      diagnostics: dedupe([
        ...sorted.flatMap((cluster) => cluster.diagnostics),
        ...(reconciliationMode === 'compatible_merge'
          ? ['duplicate_url_compatible_clusters_merged']
          : []),
        ...conflicts,
      ]).sort(),
      originalClusterIds,
      normalizedConcreteUrls: urls,
      reconciliationMode,
      conflictReasons: conflicts,
      identitySnapshots,
    };
  });
  draftInputs.sort((left, right) => left.clusterId.localeCompare(right.clusterId));
  assertOneInputPerConcreteUrl(draftInputs);
  return {
    draftInputs,
    duplicateUrlGroups,
    compatibleMergedGroups,
    conflictGroups,
  };
}

function evidenceValue<T>(value: { value: T } | undefined): T | undefined {
  return value?.value;
}

/** Preserves source-family URL roles while reusing the existing Unified draft service. */
export function reconciledClusterToConnectorOutputs(
  input: ReconciledDraftInput,
): ConnectorOutput[] {
  const forceConflict = input.reconciliationMode === 'identity_conflict';
  return input.contributions.map(({ evidence }) => ({
    sourceId: evidence.sourceId,
    sourceFamily: evidence.sourceFamily,
    sourceUrl: evidence.sourceUrl,
    requestedSourceUrl: evidence.requestedSourceUrl,
    finalSourceUrl: evidence.finalSourceUrl,
    verifiedAt: evidence.verifiedAt,
    title: evidenceValue(evidence.identity.title),
    startDate: evidenceValue(evidence.identity.startDate),
    endDate: evidenceValue(evidence.identity.endDate),
    venueName: evidenceValue(evidence.identity.venueName),
    locationText: evidenceValue(evidence.identity.locationText),
    officialWebsiteUrl: evidenceValue(evidence.identity.officialWebsiteUrl),
    outboundTicketUrls: evidence.identity.outboundTicketUrls,
    description: evidenceValue(evidence.content.description),
    genres: evidenceValue(evidence.content.genres),
    lineup: evidenceValue(evidence.content.lineup),
    lineupState: evidenceValue(evidence.content.lineupState),
    lineupReason: evidenceValue(evidence.content.lineupReason),
    minimumAge: evidenceValue(evidence.content.minimumAge),
    venueEnvironment: evidenceValue(evidence.content.venueEnvironment),
    publicTicketUrl: evidenceValue(evidence.tickets.publicTicketUrl),
    checkoutEvidenceUrl: evidenceValue(evidence.tickets.checkoutEvidenceUrl),
    admissionPrice: evidenceValue(evidence.tickets.admissionPrice),
    ticketPhases: evidenceValue(evidence.tickets.ticketPhases),
    admissionProducts: evidenceValue(evidence.tickets.admissionProducts),
    excludedProducts: evidenceValue(evidence.tickets.excludedProducts),
    ticketStatus: evidenceValue(evidence.tickets.ticketStatus),
    duplicateCandidate: evidence.duplicateCandidate || forceConflict,
    diagnostics: dedupe([...evidence.diagnostics, ...input.diagnostics]),
  }));
}

/** Adds reconciliation audit without silently selecting conflicting identity fields. */
export function applyDuplicateUrlReconciliationToDraft(
  draft: ImportDraft,
  input: ReconciledDraftInput,
): ImportDraft {
  if (input.reconciliationMode === 'none') return draft;
  const audit = {
    normalizedUrls: input.normalizedConcreteUrls,
    clusterIds: input.originalClusterIds,
    mode: input.reconciliationMode,
    conflictReasons: input.conflictReasons,
    identitySnapshots: input.identitySnapshots,
  };
  if (input.reconciliationMode === 'compatible_merge') {
    return {
      ...draft,
      audit: { ...draft.audit, duplicateUrlReconciliation: audit },
    };
  }
  return {
    ...draft,
    proposedCanonicalEvent: undefined,
    reviewTrack: 'conflict_review',
    reviewReasons: dedupe([...draft.reviewReasons, ...input.conflictReasons]),
    recommendedDuplicateAction: 'review_duplicate_url_identity',
    fieldGroupConfidence: {
      ...draft.fieldGroupConfidence,
      identity: 'missing',
    },
    audit: { ...draft.audit, duplicateUrlReconciliation: audit },
  };
}
