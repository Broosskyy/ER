import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import type { ImportRecord } from '@/features/import/models/types';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { sourceQualityResolver } from '@/features/sources/domain/source-quality-resolver';
import type {
  ImportRecordQualityResult,
  TrustQualityRule,
  TrustQualityRuleViolation,
} from '../domain/trust-quality-types';
import { resolveTrustQualityThresholds } from '../domain/trust-quality-config';
import { matchingConfig } from '@/features/import/matching/matching-config';

function isValidIsoDate(value?: string): boolean {
  if (!value?.trim()) {
    return false;
  }
  return Number.isFinite(new Date(value).getTime());
}

function isValidHttpUrl(value?: string): boolean {
  if (!value?.trim()) {
    return true;
  }
  return /^https?:\/\//i.test(value);
}

function readField(candidate: NormalizedEventCandidate, field: string): unknown {
  return (candidate as unknown as Record<string, unknown>)[field];
}

function evaluateRule(
  rule: TrustQualityRule,
  record: ImportRecord,
  candidate: NormalizedEventCandidate,
  thresholds: ReturnType<typeof resolveTrustQualityThresholds>,
): TrustQualityRuleViolation | null {
  const field = typeof rule.config.field === 'string' ? rule.config.field : undefined;

  switch (rule.ruleKey) {
    case 'required_title':
      return candidate.title?.trim()
        ? null
        : violation(rule, 'Title is required.', ['title']);
    case 'required_start_date':
      return candidate.startDate?.trim()
        ? null
        : violation(rule, 'Start date is required.', ['startDate']);
    case 'invalid_start_date':
      return isValidIsoDate(candidate.startDate)
        ? null
        : violation(rule, 'Start date is invalid.', ['startDate']);
    case 'missing_venue':
      return candidate.venueName?.trim()
        ? null
        : violation(rule, 'Venue is missing.', ['venueName']);
    case 'missing_city':
      return candidate.cityName?.trim()
        ? null
        : violation(rule, 'City is missing.', ['cityName']);
    case 'missing_organizer':
      return candidate.organizerName?.trim()
        ? null
        : violation(rule, 'Organizer is missing.', ['organizerName']);
    case 'missing_image':
      return candidate.imageUrl?.trim() || (candidate.imageUrls?.length ?? 0) > 0
        ? null
        : violation(rule, 'Image is missing.', ['imageUrl']);
    case 'invalid_ticket_url':
      return isValidHttpUrl(candidate.ticketUrl)
        ? null
        : violation(rule, 'Ticket URL is invalid.', ['ticketUrl']);
    case 'duplicate_threshold':
      if (
        record.duplicateScore !== undefined &&
        record.duplicateScore >= thresholds.duplicateThreshold &&
        record.duplicateDecision !== 'dismissed'
      ) {
        return violation(rule, 'Potential duplicate detected.', ['duplicateScore']);
      }
      return null;
    case 'validation_errors':
      return (record.validationErrors?.length ?? 0) > 0
        ? violation(
            rule,
            'Validation errors present.',
            (record.validationErrors ?? []).map((issue) => issue.code ?? issue.message),
          )
        : null;
    case 'low_extraction_confidence': {
      const metadata = candidate.sourceMetadata ?? {};
      const payload = record.normalizedPayload as Record<string, unknown> | undefined;
      const confidence =
        (metadata.extractionConfidence as number | undefined) ??
        (payload?.extractionConfidence as number | undefined);
      if (confidence !== undefined && confidence < thresholds.minExtractionConfidence) {
        return violation(rule, 'Extraction confidence is below threshold.', ['extractionConfidence']);
      }
      return null;
    }
    default:
      if (field) {
        const value = readField(candidate, field);
        if (value === undefined || value === null || value === '') {
          return violation(rule, `Field ${field} is missing.`, [field]);
        }
      }
      return null;
  }
}

function violation(
  rule: TrustQualityRule,
  message: string,
  affectedFields: string[],
): TrustQualityRuleViolation {
  return {
    ruleId: rule.id,
    ruleKey: rule.ruleKey,
    category: rule.category,
    severity: rule.severity,
    decisionImpact: rule.decisionImpact,
    message,
    affectedFields,
  };
}

export class ImportRecordQualityEvaluator {
  evaluate(
    record: ImportRecord,
    rules: TrustQualityRule[],
    now = new Date(),
  ): ImportRecordQualityResult {
    const candidate = getEffectiveCandidate(record);
    const thresholds = resolveTrustQualityThresholds({
      duplicateThreshold: matchingConfig.duplicateThreshold,
    });
    const violations = rules
      .filter((rule) => rule.enabled)
      .map((rule) => evaluateRule(rule, record, candidate, thresholds))
      .filter((entry): entry is TrustQualityRuleViolation => Boolean(entry));

    const sourceQuality = sourceQualityResolver.resolve([
      {
        externalId: candidate.externalId,
        sourceId: record.sourceId,
        sourceName: record.sourceName ?? record.sourceId,
        title: candidate.title,
        description: candidate.description,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        venueName: candidate.venueName,
        cityName: candidate.cityName,
        countryCode: candidate.countryCode,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        genreNames: candidate.genreNames,
        artistNames: candidate.artistNames,
        ticketUrl: candidate.ticketUrl,
        imageUrl: candidate.imageUrl,
        imageUrls: candidate.imageUrls,
        organizerName: candidate.organizerName,
        originalLink: candidate.originalLink ?? candidate.eventUrl,
        rawSourceType: candidate.rawSourceType,
      },
    ]);

    const blockingIssues = violations
      .filter((entry) => entry.severity === 'blocking')
      .map((entry) => entry.message);
    const warnings = violations
      .filter((entry) => entry.severity === 'warning')
      .map((entry) => entry.message);

    const penalty = violations.reduce((total, entry) => {
      if (entry.severity === 'blocking') return total + 25;
      if (entry.severity === 'warning') return total + 10;
      return total + 4;
    }, 0);

    const score = Math.max(0, Math.round(sourceQuality.qualityScore - penalty));
    const tier = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';

    return {
      score,
      tier,
      completeness: sourceQuality.qualityScore,
      missingFields: sourceQuality.missingFields,
      blockingIssues,
      warnings,
      violations,
      calculatedAt: now.toISOString(),
    };
  }
}

export const importRecordQualityEvaluator = new ImportRecordQualityEvaluator();
