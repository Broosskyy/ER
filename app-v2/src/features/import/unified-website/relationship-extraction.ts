import type { RelationshipCandidate } from '@/features/import/contracts/unified-import-result';

import { resolveProviderAdapter } from './provider-adapters';
import type { DetailPageExtraction } from './types';

export function buildRelationshipCandidates(
  pageUrl: string,
  sourceId: string,
  detail: DetailPageExtraction,
): RelationshipCandidate[] {
  const adapter = resolveProviderAdapter(pageUrl);
  const relationships: RelationshipCandidate[] = [];

  const organizerLabel = detail.organizerName ?? adapter?.resolveOrganizerLabel?.(pageUrl);
  if (organizerLabel) {
    relationships.push({
      relationshipType: 'organizer',
      entityLabel: organizerLabel,
      sourceId,
      evidenceUrl: pageUrl,
      confidence: detail.organizerName ? 0.9 : 0.82,
    });
  }

  const promoterLabel = adapter?.resolvePromoterLabel?.(pageUrl);
  if (promoterLabel && promoterLabel !== organizerLabel) {
    relationships.push({
      relationshipType: 'promoter',
      entityLabel: promoterLabel,
      sourceId,
      evidenceUrl: pageUrl,
      confidence: 0.8,
    });
  }

  if (detail.venue && detail.venue.strategy !== 'provider_default_candidate') {
    relationships.push({
      relationshipType: 'venue',
      entityLabel: detail.venue.venueName,
      sourceId,
      evidenceUrl: pageUrl,
      confidence: detail.venue.confidence,
    });
  }

  relationships.push({
    relationshipType: 'official_page',
    entityLabel: adapter?.key ?? 'official_website',
    sourceId,
    evidenceUrl: pageUrl,
    confidence: 0.88,
  });

  return relationships;
}

export function resolveSourceRoles(pageUrl: string): string[] {
  const adapter = resolveProviderAdapter(pageUrl);
  return adapter?.sourceRoles ?? ['official_website_source'];
}
