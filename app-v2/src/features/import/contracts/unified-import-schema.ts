/**
 * Phase 4.8.1.1 — machine-checkable unified import result validation.
 */
import type { FieldEvidenceCandidate, UnifiedImportResult } from '@/features/import/contracts';

export interface ContractConformanceFailure {
  code: string;
  message: string;
  path?: string;
}

const MANDATORY_TOP_LEVEL = [
  'contractVersion',
  'stagingOnly',
  'sourceIdentity',
  'importRunIdentity',
  'rawEvidenceReferences',
  'eventIdentityCandidates',
  'fieldEvidenceCandidates',
  'relationshipCandidates',
  'reviewFindings',
  'extractionDiagnostics',
  'completeness',
  'confidence',
  'importerVersion',
] as const;

const VALID_SOURCE_ROLES = new Set([
  'organizer',
  'promoter',
  'official_website_source',
  'ticket_platform',
  'checkout_provider',
  'venue',
  'discovery_source',
]);

export function validateUnifiedImportResult(result: UnifiedImportResult): ContractConformanceFailure[] {
  const failures: ContractConformanceFailure[] = [];

  if (result.contractVersion !== 'phase481-v1') {
    failures.push({ code: 'INVALID_CONTRACT_VERSION', message: `Expected phase481-v1, got ${result.contractVersion}` });
  }
  if (!result.stagingOnly) {
    failures.push({ code: 'NOT_STAGING_ONLY', message: 'Pilot result must be stagingOnly: true' });
  }

  for (const key of MANDATORY_TOP_LEVEL) {
    if ((result as unknown as Record<string, unknown>)[key] === undefined) {
      failures.push({ code: 'MISSING_TOP_LEVEL', message: `Missing mandatory section: ${key}`, path: key });
    }
  }

  if (!result.importRunIdentity?.runId?.startsWith('phase481-pilot-')) {
    failures.push({ code: 'INVALID_RUN_ID', message: 'Import run identity must be stable pilot prefix' });
  }

  if (result.importRunIdentity?.channel !== 'automatic_source_import' && result.importRunIdentity?.channel !== 'manual_admin_import') {
    failures.push({ code: 'INVALID_CHANNEL', message: 'Invalid import channel provenance' });
  }

  for (const candidate of result.fieldEvidenceCandidates) {
    validateFieldCandidate(candidate, failures);
  }

  if (result.eventIdentityCandidates.length === 0 && result.fieldEvidenceCandidates.length > 0) {
    failures.push({ code: 'MISSING_IDENTITY_EVIDENCE', message: 'Field evidence without event identity candidates' });
  }

  const checkoutAsCta = result.fieldEvidenceCandidates.find(
    (c) =>
      c.fieldName === 'ticket_destination' &&
      c.sourceRole === 'checkout_provider' &&
      String(c.normalizedValue).includes('nacht-manager'),
  );
  const tkPageExists = result.relationshipCandidates.some((r) => r.relationshipType === 'ticket_platform');
  if (checkoutAsCta && tkPageExists) {
    failures.push({
      code: 'CHECKOUT_AS_CTA_VIOLATION',
      message: 'Checkout provider cannot be consumer CTA when Ticket Kings event page exists',
    });
  }

  return failures;
}

function validateFieldCandidate(candidate: FieldEvidenceCandidate, failures: ContractConformanceFailure[]): void {
  if (!candidate.originUrl) {
    failures.push({ code: 'MISSING_PROVENANCE_URL', message: `Field ${candidate.fieldName} missing originUrl` });
  }
  if (!candidate.inclusionReason) {
    failures.push({ code: 'MISSING_INCLUSION_REASON', message: `Field ${candidate.fieldName} missing inclusionReason` });
  }
  if (!candidate.importerVersion) {
    failures.push({ code: 'MISSING_IMPORTER_VERSION', message: `Field ${candidate.fieldName} missing importerVersion` });
  }
  if (!VALID_SOURCE_ROLES.has(candidate.sourceRole)) {
    failures.push({
      code: 'INVALID_SOURCE_ROLE',
      message: `Field ${candidate.fieldName} has invalid sourceRole: ${candidate.sourceRole}`,
    });
  }
  if (candidate.rawValue !== undefined && candidate.normalizedValue === undefined) {
    failures.push({ code: 'MISSING_NORMALIZED_VALUE', message: `Field ${candidate.fieldName} has raw but no normalized value` });
  }
}

export function validateAllPilotResults(results: UnifiedImportResult[]): {
  pass: boolean;
  failureCount: number;
  failures: ContractConformanceFailure[];
} {
  const failures = results.flatMap((r) =>
    validateUnifiedImportResult(r).map((f) => ({ ...f, path: `${r.sourceIdentity.importerKey}:${f.path ?? f.code}` })),
  );
  return { pass: failures.length === 0, failureCount: failures.length, failures };
}
