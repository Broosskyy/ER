import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { NormalizedImportPayload } from '@/features/aggregation/pipeline/steps/normalize-step';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { importCandidateValidator } from '@/features/import/validation/import-candidate-validator';
import type { ValidationIssue } from '@/features/import/validation/validation-codes';

export interface ValidatedImportPayload {
  externalId: string;
  rawPayload: Record<string, unknown>;
  canonicalEvent: CanonicalImportEvent;
  valid: boolean;
  validationErrors: ValidationIssue[];
  validationWarnings: ValidationIssue[];
}

function toNormalizedCandidate(event: CanonicalImportEvent) {
  return {
    externalId: event.externalId,
    sourceUrl: event.sourceUrl,
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    isAllDay: event.isAllDay,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    cityName: event.cityName,
    countryCode: event.countryCode,
    latitude: event.latitude,
    longitude: event.longitude,
    artistNames: event.artistNames,
    genreNames: event.genreNames,
    ticketUrl: event.ticketUrl,
    eventUrl: event.eventUrl,
    imageUrl: event.imageUrl,
    imageUrls: event.imageUrls,
    priceAmount: event.priceAmount,
    priceCurrency: event.priceCurrency,
    organizerName: event.organizerName,
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    rawSourceType: event.rawSourceType,
    sourceMetadata: event.sourceMetadata,
  };
}

export class ValidateStep {
  readonly stepName = 'validate' as const;

  async execute(
    payloads: NormalizedImportPayload[],
    _context: PipelineRunContext,
  ): Promise<PipelineStepResult<ValidatedImportPayload>> {
    const started = Date.now();
    const items: ValidatedImportPayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const payload of payloads) {
      if (!payload.canonicalEvent) {
        errors.push(`Missing canonical event for ${payload.externalId}.`);
        continue;
      }

      const validation = importCandidateValidator.validate(toNormalizedCandidate(payload.canonicalEvent));
      warnings.push(...validation.warnings.map((issue) => issue.message));
      if (!validation.valid) {
        errors.push(...validation.errors.map((issue) => issue.message));
      }

      items.push({
        externalId: payload.externalId,
        rawPayload: payload.rawPayload,
        canonicalEvent: payload.canonicalEvent,
        valid: validation.valid,
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      });
    }

    return {
      step: this.stepName,
      items,
      warnings,
      errors,
      durationMs: Date.now() - started,
    };
  }
}
