import { createHash } from 'node:crypto';

import type { AdminEventRecord } from '@/data/types/records';

import type { BulkRebuildEventRow } from './types';

export type ForensicEligibility =
  | 'safe_field_patch'
  | 'safe_no_change'
  | 'review_identity'
  | 'review_collision'
  | 'review_core_missing'
  | 'review_live_unavailable'
  | 'blocked_contamination'
  | 'blocked_manual_lock'
  | 'blocked_destructive_patch'
  | 'blocked_stale_evidence';

export interface ForensicFieldDelta {
  field: string;
  fieldGroup: string;
  before: unknown;
  after: unknown;
  materialChange: boolean;
  evidenceSource?: string;
  allowed: boolean;
  blockReason?: string;
}

export interface ForensicAuditEntry {
  eventId: string;
  clusterId?: string;
  rowOrigin?: string;
  titleAudit?: string;
  identityVerdict: string;
  nativeIdentityEvidence: Array<Record<string, unknown>>;
  verifiedAt?: string | null;
  collisionState: Record<string, unknown>;
  manualLocks: string[];
  contamination: boolean;
  currentEventFingerprint: Record<string, unknown>;
  proposedFieldGroups: string[];
  proposedFields: string[];
  fieldDeltas: ForensicFieldDelta[];
  consumerBefore?: Record<string, unknown>;
  consumerAfter?: Record<string, unknown>;
  unsafeReasons: string[];
  finalEligibility: ForensicEligibility;
  selectionScore?: number;
}

const INVALID_PHASE_48673_MANIFEST_HASH =
  '978aed3839e10116d7b2cab20564c2e6c9ec045869cd73401780820bd175dad5';

const FIELD_GROUP_MAP: Record<string, string> = {
  title: 'identity',
  startDate: 'schedule',
  endDate: 'schedule',
  timezone: 'schedule',
  venueName: 'venue',
  venueCity: 'venue',
  venueAddress: 'venue',
  organizerName: 'identity',
  websiteUrl: 'official',
  description: 'content',
  genreLabels: 'content',
  lineupArtistNames: 'lineup',
  ageRestriction: 'content',
  venueEnvironment: 'content',
  imageUrl: 'content',
  ticketUrl: 'tickets',
  priceText: 'tickets',
  ticketStatus: 'tickets',
  ticketPhases: 'tickets',
  checkoutEvidenceUrl: 'tickets',
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.keys(entry as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (entry as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return entry;
  });
}

function fingerprintEvent(existing?: AdminEventRecord): Record<string, unknown> {
  if (!existing) return {};
  return {
    title: existing.title,
    startDate: existing.startDate,
    endDate: existing.endDate,
    venueName: existing.venueName,
    organizerName: existing.organizerName,
    websiteUrl: existing.websiteUrl,
    ticketUrl: existing.ticketUrl,
    priceText: existing.priceText,
    ticketStatus: existing.ticketStatus,
    genreLabels: existing.genreLabels,
    descriptionLength: existing.description?.length ?? 0,
  };
}

function sameInstant(left?: string, right?: string): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const a = Date.parse(left);
  const b = Date.parse(right);
  return !Number.isNaN(a) && !Number.isNaN(b) && a === b;
}

function normalizedTextEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  return left.replace(/\s+/g, ' ').trim() === right.replace(/\s+/g, ' ').trim();
}

function materialValueChange(field: string, before: unknown, after: unknown): boolean {
  if (field === 'startDate' || field === 'endDate') {
    return !sameInstant(String(before ?? ''), String(after ?? ''));
  }
  if (field === 'venueName' || field === 'title' || field === 'organizerName' || field === 'description') {
    return !normalizedTextEqual(before, after);
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    return stableStringify(before ?? []) !== stableStringify(after ?? []);
  }
  return stableStringify(before) !== stableStringify(after);
}

function isDestructiveRemoval(before: unknown, after: unknown): boolean {
  const beforeMeaningful =
    before !== undefined &&
    before !== null &&
    before !== '' &&
    !(Array.isArray(before) && before.length === 0);
  const afterEmpty =
    after === undefined ||
    after === null ||
    after === '' ||
    (Array.isArray(after) && after.length === 0);
  return beforeMeaningful && afterEmpty;
}

function worstIdentityVerdict(row: BulkRebuildEventRow): string {
  const order = ['mismatch', 'unverifiable', 'partial_review_only', 'corroborated', 'exact'];
  let worst = 'exact';
  for (const contribution of row.sourceContributions) {
    const idx = order.indexOf(contribution.identityVerdict);
    const worstIdx = order.indexOf(worst);
    if (idx < worstIdx) worst = contribution.identityVerdict;
  }
  return worst;
}

function hasNativeIdentityEvidence(row: BulkRebuildEventRow): boolean {
  return row.sourceContributions.some(
    (c) => c.bundle.sourceNativeEvidence && !c.bundle.criticalIdentitySelfDerived,
  );
}

function fieldAllowed(
  field: string,
  row: BulkRebuildEventRow,
  before: unknown,
  after: unknown,
): { allowed: boolean; reason?: string } {
  const group = FIELD_GROUP_MAP[field] ?? 'other';
  const locks = row.manualLocks ?? [];

  if (locks.some((lock) => lock === field || lock.includes(field))) {
    return { allowed: false, reason: 'blocked_manual_lock' };
  }

  if (isDestructiveRemoval(before, after)) {
    return { allowed: false, reason: 'blocked_destructive_patch' };
  }

  if (group === 'tickets') {
    if (field === 'ticketUrl' && row.existing?.websiteUrl && String(after).includes('ticket')) {
      // ticket CTA ok
    }
    if (
      field === 'ticketStatus' &&
      row.existing?.ticketStatus === 'on_sale' &&
      after === 'external_link'
    ) {
      return { allowed: false, reason: 'ticket_status_downgrade' };
    }
  }

  if (field === 'websiteUrl') {
    const afterStr = String(after ?? '');
    const beforeStr = String(before ?? row.existing?.websiteUrl ?? '');
    const ticketDomain = /ticket\.(io|kings)/i.test(afterStr);
    const beforeOfficial = beforeStr && !/ticket\.(io|kings)/i.test(beforeStr);
    if (ticketDomain && beforeOfficial) {
      return { allowed: false, reason: 'ticket_overwrites_website' };
    }
  }

  const verdict = worstIdentityVerdict(row);
  if (group === 'identity' || group === 'schedule' || group === 'venue') {
    if (verdict !== 'exact' && verdict !== 'corroborated') {
      return { allowed: false, reason: 'review_identity' };
    }
    if (!hasNativeIdentityEvidence(row)) {
      return { allowed: false, reason: 'missing_native_identity' };
    }
  }

  if (group === 'content' || group === 'lineup') {
    const hasOfficial = row.sourceContributions.some(
      (c) =>
        (c.bundle.content?.description || c.bundle.content?.genreLabels?.length) &&
        (c.detailEvidence?.fetchStatus === 'ok' || Boolean(c.embeddedDetailHtml)),
    );
    const hasContentEvidence =
      hasOfficial ||
      Boolean(row.rebuilt.evidenceByFieldGroup?.content?.length) ||
      Boolean(row.rebuilt.evidenceByFieldGroup?.lineup?.length);
    if (!hasContentEvidence) {
      return { allowed: false, reason: 'missing_official_content_evidence' };
    }
  }

  if (group === 'tickets') {
    const hasTicketEvidence =
      row.sourceContributions.some(
        (c) =>
          (c.bundle.sourceRole === 'ticket_platform' ||
            c.bundle.sourceRole === 'official_website_source') &&
          (c.identityVerdict === 'exact' || c.identityVerdict === 'corroborated'),
      ) || Boolean(row.rebuilt.evidenceByFieldGroup?.tickets?.length);
    if (!hasTicketEvidence) {
      return { allowed: false, reason: 'missing_ticket_evidence' };
    }
  }

  return { allowed: true };
}

function needsPublishCoreSecure(fields: string[]): boolean {
  const coreGroups = new Set(['identity', 'schedule', 'venue']);
  return fields.some((field) => coreGroups.has(FIELD_GROUP_MAP[field] ?? 'other'));
}

export function auditCandidateForensic(row: BulkRebuildEventRow): ForensicAuditEntry {
  const unsafeReasons: string[] = [];
  const fieldDeltas: ForensicFieldDelta[] = [];
  const identityVerdict = worstIdentityVerdict(row);

  for (const [field, delta] of Object.entries(row.changeSet ?? {})) {
    if (delta.after === undefined) {
      continue;
    }
    const material = materialValueChange(field, delta.before, delta.after);
    const permission = fieldAllowed(field, row, delta.before, delta.after);
    fieldDeltas.push({
      field,
      fieldGroup: FIELD_GROUP_MAP[field] ?? 'other',
      before: delta.before,
      after: delta.after,
      materialChange: material,
      allowed: permission.allowed && material,
      blockReason: permission.reason,
    });
    if (material && !permission.allowed) {
      unsafeReasons.push(`${field}:${permission.reason ?? 'blocked'}`);
    }
  }

  const allowedFields = fieldDeltas.filter((d) => d.allowed && d.materialChange).map((d) => d.field);
  const proposedFieldGroups = [...new Set(allowedFields.map((f) => FIELD_GROUP_MAP[f] ?? 'other'))];

  if (row.collision?.clusterCollision || row.disposition === 'review_collision') {
    unsafeReasons.push('review_collision');
  }
  if (row.reviewReasons?.some((r) => r.includes('contamination'))) {
    unsafeReasons.push('blocked_contamination');
  }
  if (needsPublishCoreSecure(allowedFields) && !row.rebuilt.publishCoreSecure) {
    unsafeReasons.push('review_core_missing');
  }
  if (identityVerdict === 'mismatch' || identityVerdict === 'unverifiable') {
    unsafeReasons.push('review_identity');
  }
  if (!row.rebuilt.verifiedAt) {
    unsafeReasons.push('blocked_stale_evidence');
  }
  const lockedMaterialFields = Object.entries(row.changeSet ?? {}).filter(([field, delta]) => {
    if (delta.after === undefined) return false;
    const locked = (row.manualLocks ?? []).some((lock) => lock === field || lock.includes(field));
    return locked && materialValueChange(field, delta.before, delta.after);
  });
  if (lockedMaterialFields.length > 0) {
    unsafeReasons.push('blocked_manual_lock');
  }

  let finalEligibility: ForensicEligibility;
  if (unsafeReasons.includes('blocked_contamination')) {
    finalEligibility = 'blocked_contamination';
  } else if (unsafeReasons.includes('review_collision')) {
    finalEligibility = 'review_collision';
  } else if (unsafeReasons.includes('blocked_manual_lock')) {
    finalEligibility = 'blocked_manual_lock';
  } else if (fieldDeltas.some((d) => d.materialChange && isDestructiveRemoval(d.before, d.after))) {
    finalEligibility = 'blocked_destructive_patch';
  } else if (unsafeReasons.includes('blocked_stale_evidence')) {
    finalEligibility = 'blocked_stale_evidence';
  } else if (unsafeReasons.includes('review_identity')) {
    finalEligibility = 'review_identity';
  } else if (unsafeReasons.includes('review_core_missing')) {
    finalEligibility = 'review_core_missing';
  } else if (allowedFields.length > 0) {
    finalEligibility = 'safe_field_patch';
  } else {
    finalEligibility = 'safe_no_change';
  }

  return {
    eventId: row.eventIdBefore ?? 'unknown',
    clusterId: row.clusterId,
    rowOrigin: row.rowOrigin,
    titleAudit: row.rebuilt.title,
    identityVerdict,
    nativeIdentityEvidence: row.sourceContributions.map((c) => ({
      sourceId: c.sourceId,
      externalId: c.externalId,
      role: c.bundle.sourceRole,
      identityVerdict: c.identityVerdict,
      verifiedAt: c.verifiedAt,
      detailFetchStatus: c.detailEvidence?.fetchStatus,
      eventUrl: c.candidate.eventUrl,
      ticketUrl: c.candidate.ticketUrl,
    })),
    verifiedAt: row.rebuilt.verifiedAt,
    collisionState: (row.collision ?? {}) as Record<string, unknown>,
    manualLocks: row.manualLocks ?? [],
    contamination: row.reviewReasons?.some((r) => r.includes('contamination')) ?? false,
    currentEventFingerprint: fingerprintEvent(row.existing),
    proposedFieldGroups,
    proposedFields: allowedFields,
    fieldDeltas,
    consumerBefore: row.consumerBefore,
    consumerAfter: row.consumerAfter,
    unsafeReasons: [...new Set(unsafeReasons)],
    finalEligibility,
  };
}

export function scoreForensicCandidate(entry: ForensicAuditEntry, row: BulkRebuildEventRow): number {
  if (entry.finalEligibility !== 'safe_field_patch') return -1;

  let score = 0;
  if (entry.identityVerdict === 'exact') score += 100;
  else if (entry.identityVerdict === 'corroborated') score += 80;

  if (!entry.collisionState?.clusterCollision) score += 50;
  if (entry.verifiedAt) score += 30;

  score -= entry.proposedFields.length * 2;

  const start = row.rebuilt.startDate ? Date.parse(row.rebuilt.startDate) : 0;
  if (start > Date.now()) score += 20;

  if (entry.proposedFieldGroups.every((g) => g !== 'lineup' && g !== 'venue')) score += 10;

  return score;
}

export function selectRestrictedBulkCandidates(
  audits: ForensicAuditEntry[],
  rows: BulkRebuildEventRow[],
  maxCount = 10,
  minCount = 5,
): ForensicAuditEntry[] {
  const rowById = new Map(rows.map((r) => [r.eventIdBefore, r]));
  const scored = audits
    .filter((a) => a.finalEligibility === 'safe_field_patch')
    .map((a) => ({
      audit: a,
      score: scoreForensicCandidate(a, rowById.get(a.eventId) ?? ({} as BulkRebuildEventRow)),
    }))
    .filter((s) => s.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.audit.eventId.localeCompare(right.audit.eventId);
    });

  const selected = scored.slice(0, maxCount).map((s) => {
    s.audit.selectionScore = s.score;
    return s.audit;
  });

  if (selected.length < minCount) {
    return selected;
  }
  return selected;
}

export function buildFieldGroupPatch(
  row: BulkRebuildEventRow,
  audit: ForensicAuditEntry,
): Record<string, { before: unknown; after: unknown }> {
  const patch: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of audit.proposedFields) {
    const delta = row.changeSet[field];
    if (!delta) continue;
    patch[field] = { before: delta.before, after: delta.after };
  }
  return patch;
}

export function buildRestrictedBulkManifest(
  selected: ForensicAuditEntry[],
  rows: BulkRebuildEventRow[],
): Record<string, unknown> {
  const rowById = new Map(rows.map((r) => [r.eventIdBefore, r]));
  const entries = selected.map((audit) => {
    const row = rowById.get(audit.eventId);
    const patch = row ? buildFieldGroupPatch(row, audit) : {};
    return {
      eventId: audit.eventId,
      clusterId: audit.clusterId,
      rowOrigin: audit.rowOrigin,
      identityVerdict: audit.identityVerdict,
      verifiedAt: audit.verifiedAt,
      beforeFingerprint: audit.currentEventFingerprint,
      allowedFieldGroups: audit.proposedFieldGroups,
      fieldGroupPatch: patch,
      blockedFields: Object.keys(row?.changeSet ?? {}).filter(
        (f) => !audit.proposedFields.includes(f),
      ),
      provenancePlan: audit.proposedFields.map((field) => ({
        fieldPath: field,
        sourceId: row?.sourceContributions[0]?.sourceId,
        freshnessAt: audit.verifiedAt,
      })),
      consumerBefore: audit.consumerBefore,
      consumerAfter: audit.consumerAfter,
      rollback: {
        eventFields: audit.currentEventFingerprint,
        ticketPhases: row?.existing?.ticketPhases ?? null,
      },
      cleanRebuildAudit: row?.cleanRebuildAudit,
    };
  });

  const body = {
    phase: '4.8.6.7.4',
    invalidPriorManifestHash: INVALID_PHASE_48673_MANIFEST_HASH,
    candidateCount: entries.length,
    patchSemantics: 'field_group_only_no_whole_row_replacement',
    entries,
  };

  const manifestHash = createHash('sha256').update(stableStringify(body)).digest('hex');

  return {
    ...body,
    manifestHash,
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
  };
}

export function isInvalidPriorManifestHash(hash: string): boolean {
  return hash === INVALID_PHASE_48673_MANIFEST_HASH;
}

export function auditAllReadyPartialCandidates(rows: BulkRebuildEventRow[]): ForensicAuditEntry[] {
  return rows
    .filter((row) => row.disposition === 'ready_partial')
    .map((row) => auditCandidateForensic(row));
}
