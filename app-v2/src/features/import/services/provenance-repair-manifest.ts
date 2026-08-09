import { createHash } from 'node:crypto';

export interface ProvenanceRepairCorrectionEntry {
  fieldPath: string;
  provenanceId: string;
  rollbackSnapshot: Record<string, unknown>;
  correctedFreshnessAt: string;
}

export function buildStableProvenanceRepairManifestHash(input: {
  phase: string;
  canonicalEventId: string;
  evidenceVerifiedAt: string;
  corrections: ProvenanceRepairCorrectionEntry[];
}): string {
  const payload = {
    phase: input.phase,
    canonicalEventId: input.canonicalEventId,
    evidenceVerifiedAt: input.evidenceVerifiedAt,
    corrections: input.corrections
      .map((entry) => ({
        fieldPath: entry.fieldPath,
        provenanceId: entry.provenanceId,
        rollbackSnapshot: entry.rollbackSnapshot,
        correctedFreshnessAt: entry.correctedFreshnessAt,
      }))
      .sort((left, right) => left.fieldPath.localeCompare(right.fieldPath)),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
