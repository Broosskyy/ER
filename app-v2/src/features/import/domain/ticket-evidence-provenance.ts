import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import type { CanonicalTicketWriteAudit } from '@/features/events/domain/canonical-ticket-writer';

export interface TicketEvidenceProvenanceSnapshot {
  checkoutEvidenceUrl?: string;
  publicCtaCandidateUrl?: string;
  identityVerdict: string;
  identityReason: string;
  verifiedAt?: string;
  sourceKey?: string;
  observedAt: string;
  freshnessFallbackRule?: string;
}

export interface TicketEvidencePersistenceAssessment {
  canPersistWithoutMigration: boolean;
  persistenceGap: boolean;
  recommendedFieldPaths: string[];
  recommendedSourceReferenceMetadataKeys: string[];
  followUpMigration?: string;
}

export function assessTicketEvidencePersistence(): TicketEvidencePersistenceAssessment {
  return {
    canPersistWithoutMigration: true,
    persistenceGap: false,
    recommendedFieldPaths: [
      'ticketEvidence.checkoutUrl',
      'ticketEvidence.publicCtaCandidateUrl',
      'ticketEvidence.identityVerdict',
      'ticketEvidence.verifiedAt',
      'ticketEvidence.sourceSnapshot',
    ],
    recommendedSourceReferenceMetadataKeys: [
      'checkoutEvidenceUrl',
      'publicCtaCandidateUrl',
      'identityVerdict',
      'verifiedAt',
      'ticketSourceSnapshot',
    ],
    followUpMigration:
      'Optional additive migration: first-class ticket_evidence JSON on events or dedicated ticket_evidence table for queryability; until then event_field_provenance.field_path + event_source_references.metadata suffice.',
  };
}

export function buildTicketEvidenceProvenanceRecords(input: {
  canonicalEventId: string;
  sourceId: string;
  audit: CanonicalTicketWriteAudit;
  verifiedAt?: string;
  sourceKey?: string;
  observedAt?: string;
}): Array<FieldProvenance & { fieldPath: string; canonicalEventId: string; id: string }> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const snapshot: TicketEvidenceProvenanceSnapshot = {
    checkoutEvidenceUrl: input.audit.checkoutEvidenceUrl,
    publicCtaCandidateUrl: input.audit.publicCtaCandidateUrl,
    identityVerdict: input.audit.identityVerdict,
    identityReason: input.audit.identityReason,
    verifiedAt: input.verifiedAt,
    sourceKey: input.sourceKey,
    observedAt,
    freshnessFallbackRule: input.audit.freshnessFallbackRule,
  };

  const base = {
    canonicalEventId: input.canonicalEventId,
    selectedSourceId: input.sourceId,
    selectionReason: 'ticket_evidence_snapshot',
    lastChangedAt: observedAt,
    freshnessAt: input.verifiedAt ?? observedAt,
    alternatives: [],
  };

  const records: Array<FieldProvenance & { fieldPath: string; canonicalEventId: string; id: string }> = [];

  if (snapshot.checkoutEvidenceUrl) {
    records.push({
      ...base,
      id: `provenance-${input.canonicalEventId}-ticketEvidence.checkoutUrl`,
      fieldPath: 'ticketEvidence.checkoutUrl',
      value: snapshot.checkoutEvidenceUrl,
    });
  }

  records.push({
    ...base,
    id: `provenance-${input.canonicalEventId}-ticketEvidence.snapshot`,
    fieldPath: 'ticketEvidence.sourceSnapshot',
    value: snapshot,
  });

  return records;
}

export function buildSourceReferenceTicketEvidenceMetadata(
  audit: CanonicalTicketWriteAudit,
  verifiedAt?: string,
): Record<string, unknown> {
  return {
    checkoutEvidenceUrl: audit.checkoutEvidenceUrl,
    publicCtaCandidateUrl: audit.publicCtaCandidateUrl,
    identityVerdict: audit.identityVerdict,
    identityReason: audit.identityReason,
    verifiedAt,
    observedAt: verifiedAt ?? new Date().toISOString(),
    freshnessFallbackRule: audit.freshnessFallbackRule,
  };
}
