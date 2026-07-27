import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { SourceQualityTier } from '@/features/sources/domain/source-registry';

export interface SourceQualityResult {
  qualityScore: number;
  tier: SourceQualityTier;
  reasons: string[];
  missingFields: string[];
  strengths: string[];
  calculatedAt: string;
}

const QUALITY_FIELDS: Array<{
  name: string;
  weight: number;
  present: (event: CanonicalImportEvent) => boolean;
}> = [
  { name: 'title', weight: 12, present: (event) => Boolean(event.title.trim()) },
  { name: 'startDate', weight: 12, present: (event) => Boolean(event.startDate) },
  { name: 'endDate', weight: 5, present: (event) => Boolean(event.endDate) },
  { name: 'venue', weight: 12, present: (event) => Boolean(event.venueName) },
  { name: 'city', weight: 8, present: (event) => Boolean(event.cityName && event.countryCode) },
  { name: 'coordinates', weight: 5, present: (event) => event.latitude !== undefined && event.longitude !== undefined },
  { name: 'description', weight: 10, present: (event) => Boolean(event.description?.trim()) },
  { name: 'genres', weight: 6, present: (event) => (event.genreNames?.length ?? 0) > 0 },
  { name: 'lineup', weight: 6, present: (event) => (event.artistNames?.length ?? 0) > 0 },
  { name: 'image', weight: 8, present: (event) => Boolean(event.imageUrl || event.imageUrls?.length) },
  { name: 'ticket', weight: 8, present: (event) => Boolean(event.ticketUrl) },
  { name: 'organizer', weight: 4, present: (event) => Boolean(event.organizerName) },
  { name: 'originalLink', weight: 4, present: (event) => Boolean(event.originalLink || event.eventUrl) },
];

export class SourceQualityResolver {
  resolve(events: CanonicalImportEvent[], now = new Date()): SourceQualityResult {
    if (events.length === 0) {
      return {
        qualityScore: 0,
        tier: 'unknown',
        reasons: ['No valid event records are available.'],
        missingFields: QUALITY_FIELDS.map((field) => field.name),
        strengths: [],
        calculatedAt: now.toISOString(),
      };
    }

    const totalWeight = QUALITY_FIELDS.reduce((total, field) => total + field.weight, 0);
    const coverage = QUALITY_FIELDS.map((field) => ({
      field,
      ratio: events.filter(field.present).length / events.length,
    }));
    const qualityScore = Math.round(
      coverage.reduce((total, entry) => total + entry.field.weight * entry.ratio, 0) /
        totalWeight *
        100,
    );
    const missingFields = coverage
      .filter((entry) => entry.ratio < 0.5)
      .map((entry) => entry.field.name);
    const strengths = coverage
      .filter((entry) => entry.ratio >= 0.9)
      .map((entry) => entry.field.name);
    const tier: SourceQualityTier =
      qualityScore >= 85 ? 'A' : qualityScore >= 70 ? 'B' : qualityScore >= 50 ? 'C' : 'D';

    return {
      qualityScore,
      tier,
      reasons: [`Calculated from ${events.length} valid normalized event records.`],
      missingFields,
      strengths,
      calculatedAt: now.toISOString(),
    };
  }
}

export const sourceQualityResolver = new SourceQualityResolver();
