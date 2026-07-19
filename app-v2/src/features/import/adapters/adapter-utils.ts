import type { ImportSource } from '@/features/import/models/types';
import type { ImportAdapterContext, ImportAdapterRecordResult, ImportAdapterRunResult } from '@/features/import/adapters/types';
import { eventNormalizer } from '@/features/import/normalization/event-normalizer';
import { importCandidateValidator } from '@/features/import/validation/import-candidate-validator';
import type { RawSourceType } from '@/features/import/models/normalized-event-candidate';
import type { RawCandidateInput } from '@/features/import/normalization/event-normalizer';

export function processRawCandidate(
  input: RawCandidateInput,
  source: ImportSource,
): ImportAdapterRecordResult {
  const { candidate, warnings: normalizeWarnings } = eventNormalizer.normalize({
    ...input,
    defaultTimezone: source.defaultTimezone,
    baseUrl: source.sourceUrl ?? source.website,
  });

  if (!candidate) {
    return {
      externalId: input.externalId,
      sourceUrl: input.sourceUrl,
      rawPayload: input.sourceMetadata ?? { raw: input },
      status: 'invalid',
      validationErrors: [
        { code: 'START_DATE_MISSING', message: 'Could not normalize candidate — missing required fields.' },
      ],
      validationWarnings: normalizeWarnings,
    };
  }

  const validation = importCandidateValidator.validate(candidate);
  const allWarnings = [...normalizeWarnings, ...validation.warnings];

  if (!validation.valid) {
    return {
      externalId: candidate.externalId,
      sourceUrl: candidate.sourceUrl,
      rawPayload: (input.sourceMetadata as Record<string, unknown>) ?? {},
      normalizedCandidate: candidate,
      validationErrors: validation.errors,
      validationWarnings: allWarnings,
      status: 'invalid',
    };
  }

  return {
    externalId: candidate.externalId,
    sourceUrl: candidate.sourceUrl,
    rawPayload: (input.sourceMetadata as Record<string, unknown>) ?? {},
    normalizedCandidate: candidate,
    validationWarnings: allWarnings.length > 0 ? allWarnings : undefined,
    status: 'needs_review',
  };
}

export function buildAdapterResult(
  records: ImportAdapterRecordResult[],
  warnings: string[],
  skippedCount: number,
  metadata: Record<string, unknown>,
): ImportAdapterRunResult {
  return { records, warnings, skippedCount, metadata };
}

export function getSourceUrl(source: ImportSource): string {
  return source.sourceUrl ?? source.website ?? '';
}

export function createSkippedRecord(
  externalId: string,
  rawPayload: Record<string, unknown>,
  reason: string,
): ImportAdapterRecordResult {
  return {
    externalId,
    rawPayload,
    status: 'invalid',
    skipped: true,
    skipReason: reason,
    validationErrors: [{ code: 'PAYLOAD_TYPE_INVALID', message: reason }],
  };
}

export type { RawSourceType, ImportAdapterContext };
