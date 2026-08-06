import type { SourceCapabilityDeclaration } from '@/features/sources/domain/source-capability-declaration';
import type { SourceFieldCoverageReport } from '@/features/sources/domain/source-field-coverage-analyzer';
import type { SourceRegressionReport } from '@/features/sources/domain/source-regression-detector';

export interface SourceImportHealthSnapshot {
  importJobId: string;
  eventsImported: number;
  eventsFailed: number;
  eventsWithWarnings: number;
  detailBlockedCount: number;
  coverage: SourceFieldCoverageReport;
  regressions: SourceRegressionReport;
  calculatedAt: string;
}

export interface SourceReliabilityMetadata {
  lastSnapshot?: SourceImportHealthSnapshot;
  baselineCoverage?: SourceFieldCoverageReport;
  lastRegressionAt?: string;
  lastParserChangeAt?: string;
  updatedAt: string;
}

export interface SourceReliabilitySummary {
  declaration: SourceCapabilityDeclaration;
  healthScore: number;
  qualityScore: number;
  coverage: SourceFieldCoverageReport;
  regressions: SourceRegressionReport;
  blockedFields: string[];
  lastSuccessfulImportAt?: string;
  metadata: SourceReliabilityMetadata;
}
