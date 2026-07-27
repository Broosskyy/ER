import {
  mapNormalizedCandidateToCanonical,
  type CanonicalImportEvent,
} from '@/features/aggregation/domain/canonical-import-event';
import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { FetchedImportPayload } from '@/features/aggregation/pipeline/steps/fetch-step';
import { eventNormalizer } from '@/features/import/normalization/event-normalizer';
import type { RawCandidateInput } from '@/features/import/normalization/event-normalizer';

export interface NormalizedImportPayload {
  externalId: string;
  rawPayload: Record<string, unknown>;
  canonicalEvent?: CanonicalImportEvent;
  warnings: string[];
  errors: string[];
}

function toRawCandidateInput(payload: FetchedImportPayload): RawCandidateInput | null {
  if (payload.adapterResult?.normalizedCandidate) {
    const candidate = payload.adapterResult.normalizedCandidate;
    return {
      externalId: candidate.externalId,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      description: candidate.description,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      timezone: candidate.timezone,
      isAllDay: candidate.isAllDay,
      venueName: candidate.venueName,
      venueAddress: candidate.venueAddress,
      cityName: candidate.cityName,
      countryCode: candidate.countryCode,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      artistNames: candidate.artistNames,
      genreNames: candidate.genreNames,
      ticketUrl: candidate.ticketUrl,
      eventUrl: candidate.eventUrl,
      imageUrl: candidate.imageUrl,
      minimumAge: candidate.minimumAge,
      organizerName: candidate.organizerName,
      rawSourceType: candidate.rawSourceType,
      sourceMetadata: candidate.sourceMetadata,
    };
  }

  const raw = payload.rawPayload;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (raw.title || raw.startDate) {
    return {
      externalId: payload.externalId,
      sourceUrl: payload.sourceUrl ?? (typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined),
      title: raw.title,
      subtitle: raw.subtitle,
      description: raw.description,
      startDate: raw.startDate,
      endDate: raw.endDate,
      timezone: typeof raw.timezone === 'string' ? raw.timezone : undefined,
      isAllDay: typeof raw.isAllDay === 'boolean' ? raw.isAllDay : undefined,
      venueName: raw.venueName,
      venueAddress: raw.venueAddress,
      cityName: raw.cityName,
      countryCode: raw.countryCode,
      latitude: raw.latitude,
      longitude: raw.longitude,
      artistNames: raw.artistNames,
      genreNames: raw.genreNames,
      ticketUrl: raw.ticketUrl,
      eventUrl: raw.eventUrl,
      imageUrl: raw.imageUrl,
      imageUrls: raw.imageUrls,
      priceAmount: raw.priceAmount,
      priceCurrency: raw.priceCurrency,
      organizerName: raw.organizerName,
      importId: raw.importId,
      originalLink: raw.originalLink,
      rawSourceType: (raw.rawSourceType as RawCandidateInput['rawSourceType']) ?? 'unknown',
      sourceMetadata:
        typeof raw.sourceMetadata === 'object' && raw.sourceMetadata
          ? (raw.sourceMetadata as Record<string, unknown>)
          : raw,
    };
  }

  return {
    externalId: payload.externalId,
    sourceUrl: payload.sourceUrl,
    title: raw.title,
    description: raw.description,
    startDate: raw.startDate,
    endDate: raw.endDate,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : undefined,
    venueName: raw.venueName,
    venueAddress: raw.venueAddress,
    cityName: raw.cityName,
    countryCode: raw.countryCode,
    latitude: raw.latitude,
    longitude: raw.longitude,
    artistNames: raw.artistNames,
    genreNames: raw.genreNames,
    ticketUrl: raw.ticketUrl,
    eventUrl: raw.eventUrl,
    imageUrl: raw.imageUrl,
    organizerName: raw.organizerName,
    rawSourceType: 'unknown',
    sourceMetadata: raw,
  };
}

export class NormalizeStep {
  readonly stepName = 'normalize' as const;

  async execute(
    payloads: FetchedImportPayload[],
    context: PipelineRunContext,
  ): Promise<PipelineStepResult<NormalizedImportPayload>> {
    const started = Date.now();
    const items: NormalizedImportPayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const payload of payloads) {
      const input = toRawCandidateInput(payload);
      if (!input) {
        errors.push(`Could not map raw payload for ${payload.externalId}.`);
        items.push({
          externalId: payload.externalId,
          rawPayload: payload.rawPayload,
          warnings: [],
          errors: ['RAW_PAYLOAD_INVALID'],
        });
        continue;
      }

      const { candidate, warnings: normalizeWarnings } = eventNormalizer.normalize({
        ...input,
        defaultTimezone: context.source.defaultTimezone,
        countryCode: input.countryCode ?? context.source.countryCode,
      });

      const itemWarnings = normalizeWarnings.map((issue) => issue.message);
      warnings.push(...itemWarnings);

      if (!candidate) {
        errors.push(`Normalization failed for ${payload.externalId}.`);
        items.push({
          externalId: payload.externalId,
          rawPayload: payload.rawPayload,
          warnings: itemWarnings,
          errors: ['NORMALIZATION_FAILED'],
        });
        continue;
      }

      const enriched = {
        ...candidate,
        sourceId: context.source.id,
        sourceName: context.source.name,
        countryCode: candidate.countryCode ?? context.source.countryCode,
      };

      items.push({
        externalId: payload.externalId,
        rawPayload: payload.rawPayload,
        canonicalEvent: mapNormalizedCandidateToCanonical(enriched, context.source),
        warnings: itemWarnings,
        errors: [],
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
