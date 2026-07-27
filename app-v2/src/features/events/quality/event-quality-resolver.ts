import type { Event } from '@/features/events/types/event';
import type { EventConflict } from '@/features/aggregation/merge/event-conflict';

export interface EventQualityResult {
  score: number;
  tier: 'A' | 'B' | 'C' | 'D';
  completeness: number;
  trust: number;
  freshness: number;
  mediaQuality: number;
  ticketQuality: number;
  locationQuality: number;
  reasons: string[];
  missingFields: string[];
  blockingIssues: string[];
  calculatedAt: string;
}

export class EventQualityResolver {
  resolve(
    event: Event,
    input: { sourceTrust?: number; conflicts?: EventConflict[]; publishedAt?: string } = {},
    now = new Date(),
  ): EventQualityResult {
    const checks = [
      ['title', Boolean(event.title), 12],
      ['startDateTime', Boolean(event.startDateTime), 12],
      ['venue', Boolean(event.venue), 10],
      ['city', Boolean(event.city && event.country), 10],
      ['coordinates', event.latitude !== undefined && event.longitude !== undefined, 6],
      ['description', Boolean(event.description), 8],
      ['genres', event.genres.length > 0, 6],
      ['organizer', Boolean(event.organizer), 5],
      ['image', Boolean(event.imageUrl), 8],
      ['ticket', Boolean(event.ticketUrl), 8],
      ['lineup', (event.lineup?.length ?? event.artists.length) > 0, 5],
    ] as const;
    const maxCompleteness = checks.reduce((total, [, , weight]) => total + weight, 0);
    const completenessScore = checks.reduce(
      (total, [, present, weight]) => total + (present ? weight : 0),
      0,
    ) / maxCompleteness * 100;
    const missingFields = checks.filter(([, present]) => !present).map(([name]) => name);
    const criticalConflicts = (input.conflicts ?? []).filter(
      (conflict) => !conflict.resolved && conflict.severity === 'critical',
    );
    const freshness = input.publishedAt
      ? Math.max(0, 100 - (now.getTime() - new Date(input.publishedAt).getTime()) / 86_400_000)
      : 50;
    const trust = input.sourceTrust ?? 50;
    const mediaQuality = event.imageUrl ? 100 : 0;
    const ticketQuality = event.ticketUrl ? 100 : 0;
    const locationQuality = event.latitude !== undefined && event.longitude !== undefined ? 100 : 65;
    const score = Math.max(0, Math.round(
      completenessScore * 0.55 + trust * 0.2 + freshness * 0.1 +
      mediaQuality * 0.05 + ticketQuality * 0.05 + locationQuality * 0.05 -
      criticalConflicts.length * 25,
    ));
    const tier = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
    return {
      score,
      tier,
      completeness: Math.round(completenessScore),
      trust,
      freshness: Math.round(freshness),
      mediaQuality,
      ticketQuality,
      locationQuality,
      reasons: [`Calculated from canonical event completeness and ${criticalConflicts.length} critical conflicts.`],
      missingFields,
      blockingIssues: criticalConflicts.map((conflict) => `critical_conflict:${conflict.field}`),
      calculatedAt: now.toISOString(),
    };
  }
}

export const eventQualityResolver = new EventQualityResolver();
