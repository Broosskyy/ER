import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import {
  buildEntityCandidateKey,
  extractDomain,
  normalizeIdentityText,
} from '@/features/entity-resolution/entity-alias-store';
import type {
  EntityAliasStore,
  EntityIdentityAlias,
  EntityResolutionDecisionRecord,
  EntityType,
} from '@/features/entity-resolution/types';
import { readCandidateMetadataString, resolveImportSourceId } from '@/features/import/matching/entity-resolution-match-bridge';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import type { ImportRecord, ReviewerEdits } from '@/features/import/models/types';

export interface EntityResolutionWritebackAuditEntry {
  action: 'entity_resolution_decision' | 'entity_resolution_alias';
  summary: string;
  metadata: Record<string, unknown>;
}

export interface EntityResolutionWritebackPlan {
  decisions: EntityResolutionDecisionRecord[];
  aliases: EntityIdentityAlias[];
  auditEntries: EntityResolutionWritebackAuditEntry[];
}

export interface EntityResolutionWritebackContext {
  record: ImportRecord;
  candidate: NormalizedEventCandidate;
  actorId: string;
  trigger: 'edit' | 'approve';
  edits?: ReviewerEdits;
  now?: string;
}

interface EntityMetadata {
  externalId?: string;
  url?: string;
  socialHandle?: string;
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

export function touchesEntityResolutionEdits(edits: ReviewerEdits): boolean {
  return (
    edits.matchedVenueId !== undefined ||
    edits.matchedOrganizerId !== undefined ||
    edits.matchedArtistIds !== undefined ||
    edits.keepSeparateVenue === true ||
    edits.keepSeparateOrganizer === true ||
    (edits.keepSeparateArtistNames?.length ?? 0) > 0
  );
}

export function buildEntityResolutionWritebackPlan(
  context: EntityResolutionWritebackContext,
): EntityResolutionWritebackPlan {
  const timestamp = nowIso(context.now);
  const resolvedSourceId = resolveImportSourceId(context.candidate);
  const sourceId =
    resolvedSourceId !== 'unknown' ? resolvedSourceId : context.record.sourceId;
  const decisions: EntityResolutionDecisionRecord[] = [];
  const aliases: EntityIdentityAlias[] = [];
  const auditEntries: EntityResolutionWritebackAuditEntry[] = [];

  const venueMetadata: EntityMetadata = {
    externalId: readCandidateMetadataString(
      context.candidate,
      'externalVenueId',
      'venueExternalId',
    ),
    url: readCandidateMetadataString(context.candidate, 'venueWebsite', 'venueUrl'),
  };
  const organizerMetadata: EntityMetadata = {
    externalId: readCandidateMetadataString(
      context.candidate,
      'externalOrganizerId',
      'organizerExternalId',
    ),
    url: readCandidateMetadataString(context.candidate, 'organizerUrl', 'organizerWebsite'),
    socialHandle: readCandidateMetadataString(context.candidate, 'organizerSocialHandle'),
  };
  const artistMetadata: EntityMetadata = {
    externalId: readCandidateMetadataString(
      context.candidate,
      'externalArtistId',
      'artistExternalId',
    ),
    url: readCandidateMetadataString(context.candidate, 'artistProfileUrl', 'artistUrl'),
    socialHandle: readCandidateMetadataString(context.candidate, 'artistSocialHandle'),
  };

  if (context.trigger === 'edit') {
    appendVenueWriteback({
      context,
      sourceId,
      timestamp,
      metadata: venueMetadata,
      decisions,
      aliases,
      auditEntries,
      includeDecision: true,
      includeAliases: true,
    });
    appendOrganizerWriteback({
      context,
      sourceId,
      timestamp,
      metadata: organizerMetadata,
      decisions,
      aliases,
      auditEntries,
      includeDecision: true,
      includeAliases: true,
    });
    appendArtistWriteback({
      context,
      sourceId,
      timestamp,
      metadata: artistMetadata,
      decisions,
      aliases,
      auditEntries,
      includeDecision: true,
      includeAliases: true,
    });
  } else {
    appendVenueWriteback({
      context,
      sourceId,
      timestamp,
      metadata: venueMetadata,
      decisions,
      aliases,
      auditEntries,
      includeDecision: true,
      includeAliases: true,
    });
    appendOrganizerWriteback({
      context,
      sourceId,
      timestamp,
      metadata: organizerMetadata,
      decisions,
      aliases,
      auditEntries,
      includeDecision: true,
      includeAliases: true,
    });
    appendArtistWriteback({
      context,
      sourceId,
      timestamp,
      metadata: artistMetadata,
      decisions,
      aliases,
      auditEntries,
      includeDecision: true,
      includeAliases: true,
    });
  }

  return { decisions, aliases, auditEntries };
}

export function applyEntityResolutionWritebackPlan(
  aliasStore: EntityAliasStore,
  plan: EntityResolutionWritebackPlan,
): void {
  for (const alias of plan.aliases) {
    aliasStore.saveAlias(alias);
  }
  for (const decision of plan.decisions) {
    aliasStore.saveDecision(decision);
  }
}

export function mapEntityAliasStoreError(error: unknown): EntityAliasStoreError {
  if (error instanceof EntityAliasStoreError) {
    return error;
  }
  return new EntityAliasStoreError('Entity resolution persistence failed.', {
    code: 'persistence_failed',
    cause: error,
  });
}

function appendVenueWriteback(input: {
  context: EntityResolutionWritebackContext;
  sourceId: string;
  timestamp: string;
  metadata: EntityMetadata;
  decisions: EntityResolutionDecisionRecord[];
  aliases: EntityIdentityAlias[];
  auditEntries: EntityResolutionWritebackAuditEntry[];
  includeDecision: boolean;
  includeAliases: boolean;
}): void {
  const edits = input.context.edits ?? input.context.record.reviewerEdits;
  const autoVenueId = input.context.record.matchedVenueId;
  const effectiveVenueId = edits?.matchedVenueId ?? autoVenueId;
  const keepSeparate = edits?.keepSeparateVenue === true;
  const candidateKey = buildVenueCandidateKey(input.context.candidate, input.sourceId, input.metadata);

  if (input.context.trigger === 'edit' && input.context.edits?.matchedVenueId === undefined && !keepSeparate) {
    return;
  }

  if (keepSeparate) {
    if (!input.includeDecision) {
      return;
    }
    pushDecision({
      entityType: 'venue',
      candidateKey,
      decision: 'keep_separate',
      context: input.context,
      timestamp: input.timestamp,
      sourceId: input.sourceId,
      normalizedInput: input.context.candidate.venueName,
      reason: 'Import review: venue kept separate.',
      decisions: input.decisions,
      auditEntries: input.auditEntries,
    });
    return;
  }

  if (!effectiveVenueId) {
    return;
  }

  const reviewerOverride =
    input.context.trigger === 'edit'
      ? Boolean(input.context.edits?.matchedVenueId)
      : Boolean(edits?.matchedVenueId && edits.matchedVenueId !== autoVenueId);

  if (input.includeDecision && (reviewerOverride || input.context.trigger === 'edit')) {
    pushDecision({
      entityType: 'venue',
      candidateKey,
      decision: 'manual_override',
      canonicalId: effectiveVenueId,
      context: input.context,
      timestamp: input.timestamp,
      sourceId: input.sourceId,
      normalizedInput: input.context.candidate.venueName,
      reason: 'Import review: manual venue match.',
      decisions: input.decisions,
      auditEntries: input.auditEntries,
    });
  }

  if (input.includeAliases) {
    pushConfirmedAliases({
      entityType: 'venue',
      canonicalId: effectiveVenueId,
      name: input.context.candidate.venueName,
      metadata: input.metadata,
      context: input.context,
      timestamp: input.timestamp,
      sourceId: input.sourceId,
      aliases: input.aliases,
      auditEntries: input.auditEntries,
    });
  }
}

function appendOrganizerWriteback(input: {
  context: EntityResolutionWritebackContext;
  sourceId: string;
  timestamp: string;
  metadata: EntityMetadata;
  decisions: EntityResolutionDecisionRecord[];
  aliases: EntityIdentityAlias[];
  auditEntries: EntityResolutionWritebackAuditEntry[];
  includeDecision: boolean;
  includeAliases: boolean;
}): void {
  const edits = input.context.edits ?? input.context.record.reviewerEdits;
  const autoOrganizerId = input.context.record.matchedOrganizerId;
  const effectiveOrganizerId = edits?.matchedOrganizerId ?? autoOrganizerId;
  const keepSeparate = edits?.keepSeparateOrganizer === true;
  const candidateKey = buildOrganizerCandidateKey(input.context.candidate, input.sourceId, input.metadata);

  if (input.context.trigger === 'edit' && input.context.edits?.matchedOrganizerId === undefined && !keepSeparate) {
    return;
  }

  if (keepSeparate) {
    if (!input.includeDecision) {
      return;
    }
    pushDecision({
      entityType: 'organizer',
      candidateKey,
      decision: 'keep_separate',
      context: input.context,
      timestamp: input.timestamp,
      sourceId: input.sourceId,
      normalizedInput: input.context.candidate.organizerName,
      reason: 'Import review: organizer kept separate.',
      decisions: input.decisions,
      auditEntries: input.auditEntries,
    });
    return;
  }

  if (!effectiveOrganizerId) {
    return;
  }

  const reviewerOverride =
    input.context.trigger === 'edit'
      ? Boolean(input.context.edits?.matchedOrganizerId)
      : Boolean(edits?.matchedOrganizerId && edits.matchedOrganizerId !== autoOrganizerId);

  if (input.includeDecision && (reviewerOverride || input.context.trigger === 'edit')) {
    pushDecision({
      entityType: 'organizer',
      candidateKey,
      decision: 'manual_override',
      canonicalId: effectiveOrganizerId,
      context: input.context,
      timestamp: input.timestamp,
      sourceId: input.sourceId,
      normalizedInput: input.context.candidate.organizerName,
      reason: 'Import review: manual organizer match.',
      decisions: input.decisions,
      auditEntries: input.auditEntries,
    });
  }

  if (input.includeAliases) {
    pushConfirmedAliases({
      entityType: 'organizer',
      canonicalId: effectiveOrganizerId,
      name: input.context.candidate.organizerName,
      metadata: input.metadata,
      context: input.context,
      timestamp: input.timestamp,
      sourceId: input.sourceId,
      aliases: input.aliases,
      auditEntries: input.auditEntries,
    });
  }
}

function appendArtistWriteback(input: {
  context: EntityResolutionWritebackContext;
  sourceId: string;
  timestamp: string;
  metadata: EntityMetadata;
  decisions: EntityResolutionDecisionRecord[];
  aliases: EntityIdentityAlias[];
  auditEntries: EntityResolutionWritebackAuditEntry[];
  includeDecision: boolean;
  includeAliases: boolean;
}): void {
  const edits = input.context.edits ?? input.context.record.reviewerEdits;
  const artistNames = input.context.candidate.artistNames ?? [];
  const autoArtistIds = input.context.record.matchedArtistIds ?? [];
  const effectiveArtistIds = edits?.matchedArtistIds ?? autoArtistIds;
  const keepSeparateNames = new Set(
    (edits?.keepSeparateArtistNames ?? []).map((name) => normalizeIdentityText(name)),
  );

  for (const [index, artistName] of artistNames.entries()) {
    const normalizedName = normalizeIdentityText(artistName);
    const keepSeparate = keepSeparateNames.has(normalizedName);
    const effectiveArtistId = effectiveArtistIds[index];
    const autoArtistId = autoArtistIds[index];
    const candidateKey = buildArtistCandidateKey(
      input.context.candidate,
      input.sourceId,
      artistName,
      input.metadata,
    );

    if (
      input.context.trigger === 'edit' &&
      input.context.edits?.matchedArtistIds === undefined &&
      !keepSeparate &&
      input.context.edits?.keepSeparateArtistNames === undefined
    ) {
      continue;
    }

    if (keepSeparate) {
      if (!input.includeDecision) {
        continue;
      }
      pushDecision({
        entityType: 'artist',
        candidateKey,
        decision: 'keep_separate',
        context: input.context,
        timestamp: input.timestamp,
        sourceId: input.sourceId,
        normalizedInput: artistName,
        reason: `Import review: artist "${artistName}" kept separate.`,
        decisions: input.decisions,
        auditEntries: input.auditEntries,
      });
      continue;
    }

    if (!effectiveArtistId) {
      continue;
    }

    const reviewerOverride =
      input.context.trigger === 'edit'
        ? Boolean(input.context.edits?.matchedArtistIds)
        : Boolean(edits?.matchedArtistIds && edits.matchedArtistIds[index] !== autoArtistId);

    if (input.includeDecision && (reviewerOverride || input.context.trigger === 'edit')) {
      pushDecision({
        entityType: 'artist',
        candidateKey,
        decision: 'manual_override',
        canonicalId: effectiveArtistId,
        context: input.context,
        timestamp: input.timestamp,
        sourceId: input.sourceId,
        normalizedInput: artistName,
        reason: `Import review: manual artist match for "${artistName}".`,
        decisions: input.decisions,
        auditEntries: input.auditEntries,
      });
    }

    if (input.includeAliases) {
      pushConfirmedAliases({
        entityType: 'artist',
        canonicalId: effectiveArtistId,
        name: artistName,
        metadata: input.metadata,
        context: input.context,
        timestamp: input.timestamp,
        sourceId: input.sourceId,
        aliases: input.aliases,
        auditEntries: input.auditEntries,
      });
    }
  }
}

function buildVenueCandidateKey(
  candidate: NormalizedEventCandidate,
  sourceId: string,
  metadata: EntityMetadata,
): string {
  return buildEntityCandidateKey({
    sourceId,
    externalId: metadata.externalId,
    name: candidate.venueName,
    address: candidate.venueAddress,
    city: candidate.cityName,
    url: metadata.url,
  });
}

function buildOrganizerCandidateKey(
  candidate: NormalizedEventCandidate,
  sourceId: string,
  metadata: EntityMetadata,
): string {
  return buildEntityCandidateKey({
    sourceId,
    externalId: metadata.externalId,
    name: candidate.organizerName,
    url: metadata.url,
    handle: metadata.socialHandle,
  });
}

function buildArtistCandidateKey(
  candidate: NormalizedEventCandidate,
  sourceId: string,
  artistName: string,
  metadata: EntityMetadata,
): string {
  return buildEntityCandidateKey({
    sourceId,
    externalId: metadata.externalId,
    name: artistName,
    url: metadata.url,
    handle: metadata.socialHandle,
  });
}

function pushDecision(input: {
  entityType: EntityType;
  candidateKey: string;
  decision: 'keep_separate' | 'manual_override';
  canonicalId?: string;
  context: EntityResolutionWritebackContext;
  timestamp: string;
  sourceId: string;
  normalizedInput?: string;
  reason: string;
  decisions: EntityResolutionDecisionRecord[];
  auditEntries: EntityResolutionWritebackAuditEntry[];
}): void {
  const record: EntityResolutionDecisionRecord = {
    entityType: input.entityType,
    candidateKey: input.candidateKey,
    decision: input.decision,
    canonicalId: input.canonicalId,
    decidedBy: input.context.actorId,
    decidedAt: input.timestamp,
    reason: input.reason,
    sourceId: input.sourceId,
    sourceExternalId: input.context.record.externalId,
    normalizedInput: input.normalizedInput,
    metadata: {
      importRecordId: input.context.record.id,
      trigger: input.context.trigger,
    },
  };

  input.decisions.push(record);
  input.auditEntries.push({
    action: 'entity_resolution_decision',
    summary: `${input.entityType} ${input.decision} for import record ${input.context.record.id}.`,
    metadata: {
      entityType: input.entityType,
      decision: input.decision,
      canonicalId: input.canonicalId,
      candidateKey: input.candidateKey,
      trigger: input.context.trigger,
    },
  });
}

function pushConfirmedAliases(input: {
  entityType: EntityType;
  canonicalId: string;
  name?: string;
  metadata: EntityMetadata;
  context: EntityResolutionWritebackContext;
  timestamp: string;
  sourceId: string;
  aliases: EntityIdentityAlias[];
  auditEntries: EntityResolutionWritebackAuditEntry[];
}): void {
  const baseMetadata = {
    importRecordId: input.context.record.id,
    trigger: input.context.trigger,
    confirmedAt: input.timestamp,
  };
  const aliasCountBefore = input.aliases.length;

  if (input.name?.trim()) {
    input.aliases.push({
      entityType: input.entityType,
      canonicalId: input.canonicalId,
      aliasType: 'normalized_name',
      aliasValue: normalizeIdentityText(input.name),
      originalAlias: input.name.trim(),
      sourceId: input.sourceId,
      createdAt: input.timestamp,
      createdBy: input.context.actorId,
      metadata: baseMetadata,
    });
  }

  if (input.metadata.externalId?.trim()) {
    input.aliases.push({
      entityType: input.entityType,
      canonicalId: input.canonicalId,
      aliasType: 'external_id',
      aliasValue: input.metadata.externalId.trim(),
      sourceId: input.sourceId,
      createdAt: input.timestamp,
      createdBy: input.context.actorId,
      metadata: baseMetadata,
    });
  }

  if (input.metadata.url?.trim()) {
    const normalizedUrl = normalizeIdentityText(input.metadata.url);
    input.aliases.push({
      entityType: input.entityType,
      canonicalId: input.canonicalId,
      aliasType: 'url',
      aliasValue: normalizedUrl,
      originalAlias: input.metadata.url.trim(),
      sourceId: input.sourceId,
      createdAt: input.timestamp,
      createdBy: input.context.actorId,
      metadata: baseMetadata,
    });

    const domain = extractDomain(input.metadata.url);
    if (domain) {
      input.aliases.push({
        entityType: input.entityType,
        canonicalId: input.canonicalId,
        aliasType: 'domain',
        aliasValue: domain,
        sourceId: input.sourceId,
        createdAt: input.timestamp,
        createdBy: input.context.actorId,
        metadata: baseMetadata,
      });
    }
  }

  if (input.metadata.socialHandle?.trim()) {
    input.aliases.push({
      entityType: input.entityType,
      canonicalId: input.canonicalId,
      aliasType: 'social_handle',
      aliasValue: normalizeIdentityText(input.metadata.socialHandle),
      originalAlias: input.metadata.socialHandle.trim(),
      sourceId: input.sourceId,
      createdAt: input.timestamp,
      createdBy: input.context.actorId,
      metadata: baseMetadata,
    });
  }

  if (input.aliases.length > aliasCountBefore) {
    input.auditEntries.push({
      action: 'entity_resolution_alias',
      summary: `${input.entityType} aliases confirmed for import record ${input.context.record.id}.`,
      metadata: {
        entityType: input.entityType,
        canonicalId: input.canonicalId,
        trigger: input.context.trigger,
      },
    });
  }
}
