import type { SourceCapabilityDeclaration } from '@/features/sources/domain/source-capability-declaration';
import { getFieldReliability } from '@/features/sources/domain/source-capability-declaration';
import type { SourceCapabilityField } from '@/features/sources/domain/source-capability-fields';
import type { FieldCoverageStat } from '@/features/sources/domain/source-field-coverage-analyzer';
import {
  isFieldExpectedFromSource,
  isFieldRegressionCandidate,
} from '@/features/sources/domain/source-field-reliability';

export type SourceRegressionSeverity = 'info' | 'warning' | 'critical';

export interface SourceFieldRegression {
  field: SourceCapabilityField;
  severity: SourceRegressionSeverity;
  code:
    | 'coverage_drop'
    | 'missing_expected_field'
    | 'parser_degradation'
    | 'blocked_detail'
    | 'unexpected_absence';
  message: string;
  previousCoveragePercent?: number;
  currentCoveragePercent?: number;
  deltaPercent?: number;
}

export interface SourceRegressionReport {
  sourceId: string;
  regressions: SourceFieldRegression[];
  warnings: string[];
  calculatedAt: string;
}

const COVERAGE_DROP_WARNING_THRESHOLD = 15;
const COVERAGE_DROP_CRITICAL_THRESHOLD = 40;
const MIN_BASELINE_EVENTS = 5;

function severityForDrop(delta: number): SourceRegressionSeverity {
  if (delta >= COVERAGE_DROP_CRITICAL_THRESHOLD) {
    return 'critical';
  }
  if (delta >= COVERAGE_DROP_WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'info';
}

export function detectSourceRegressions(input: {
  sourceId: string;
  declaration: SourceCapabilityDeclaration;
  currentFields: FieldCoverageStat[];
  baselineFields?: FieldCoverageStat[];
  detailBlockedCount?: number;
  totalEvents?: number;
  calculatedAt?: string;
}): SourceRegressionReport {
  const warnings: string[] = [];
  const regressions: SourceFieldRegression[] = [];
  const baselineByField = new Map(
    (input.baselineFields ?? []).map((entry) => [entry.field, entry]),
  );

  for (const current of input.currentFields) {
    const reliability = getFieldReliability(input.declaration, current.field);
    const baseline = baselineByField.get(current.field);

    if (reliability.status === 'blocked') {
      regressions.push({
        field: current.field,
        severity: 'info',
        code: 'blocked_detail',
        message: `${current.field} is externally blocked for this source; absence is expected.`,
        currentCoveragePercent: current.coveragePercent,
      });
      continue;
    }

    if (!isFieldExpectedFromSource(reliability)) {
      continue;
    }

    if (baseline && baseline.totalCount >= MIN_BASELINE_EVENTS) {
      const delta = baseline.coveragePercent - current.coveragePercent;
      if (delta >= COVERAGE_DROP_WARNING_THRESHOLD) {
        regressions.push({
          field: current.field,
          severity: severityForDrop(delta),
          code: 'coverage_drop',
          message: `${current.field} coverage dropped from ${baseline.coveragePercent}% to ${current.coveragePercent}%.`,
          previousCoveragePercent: baseline.coveragePercent,
          currentCoveragePercent: current.coveragePercent,
          deltaPercent: delta,
        });
      }
    }

    if (
      isFieldRegressionCandidate(reliability) &&
      current.totalCount >= MIN_BASELINE_EVENTS &&
      current.coveragePercent < 50
    ) {
      regressions.push({
        field: current.field,
        severity: 'warning',
        code: 'missing_expected_field',
        message: `${current.field} is normally supplied by this source but only ${current.coveragePercent}% of events include it.`,
        currentCoveragePercent: current.coveragePercent,
      });
    }
  }

  if ((input.detailBlockedCount ?? 0) > 0 && input.declaration.detailBlockedDefault) {
    warnings.push(
      `${input.detailBlockedCount} events carry detail-fetch blockers; lineup/description regressions may be external.`,
    );
  }

  if (regressions.some((entry) => entry.severity === 'critical')) {
    warnings.push('Critical field coverage regression detected — investigate connector/parser changes.');
  }

  return {
    sourceId: input.sourceId,
    regressions,
    warnings,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
  };
}
