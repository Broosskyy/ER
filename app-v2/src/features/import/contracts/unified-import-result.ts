import type { ImportChannel, UNIFIED_IMPORT_CONTRACT_VERSION } from './evidence-types';
import type { FieldEvidenceCandidate } from './field-evidence-candidate';
import type { EventIdentityCandidate } from './identity-candidate';
import type { LineupEvidenceEntry } from './lineup-evidence-candidate';

export interface RawEvidenceReference {
  url: string;
  fetchedAt: string;
  httpStatus: number;
  finalUrl?: string;
  error?: string;
}

export interface RelationshipCandidate {
  relationshipType: 'organizer' | 'promoter' | 'venue' | 'ticket_platform' | 'checkout_provider' | 'official_page';
  entityLabel: string;
  sourceId: string;
  evidenceUrl?: string;
  confidence: number;
}

export interface ReviewFinding {
  code: string;
  message: string;
  fieldName?: string;
  severity: 'info' | 'warning' | 'blocking';
}

export interface ExtractionDiagnostic {
  code: string;
  message: string;
  surface?: string;
  blocked?: boolean;
}

export interface CompletenessReport {
  domainsPresent: string[];
  domainsMissing: string[];
  completenessScore: number;
  blockedSurfaces: string[];
}

export interface UnifiedImportResult {
  contractVersion: typeof UNIFIED_IMPORT_CONTRACT_VERSION;
  stagingOnly: true;
  sourceIdentity: {
    sourceId: string;
    sourceName: string;
    connectorKey: string;
    importerKey: string;
    sourceRoles: string[];
  };
  importRunIdentity: {
    runId: string;
    channel: ImportChannel;
    startedAt: string;
    pilotOnly: true;
  };
  rawEvidenceReferences: RawEvidenceReference[];
  eventIdentityCandidates: EventIdentityCandidate[];
  fieldEvidenceCandidates: FieldEvidenceCandidate[];
  lineupEvidenceEntries?: LineupEvidenceEntry[];
  relationshipCandidates: RelationshipCandidate[];
  reviewFindings: ReviewFinding[];
  extractionDiagnostics: ExtractionDiagnostic[];
  completeness: CompletenessReport;
  confidence: number;
  importerVersion: string;
}

export function createPilotImportRunId(importerKey: string): string {
  return `phase481-pilot-${importerKey}-${Date.now()}`;
}
