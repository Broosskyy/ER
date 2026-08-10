import type { RebuiltCanonicalEvent, SourceEvidenceContribution } from './types';

export function buildCleanRebuildAudit(
  rebuilt: RebuiltCanonicalEvent,
  contributions: SourceEvidenceContribution[],
): {
  dbFallbackFieldsUsed: string[];
  canonicalSelfDerivedFieldsUsed: string[];
  sourceNativeFieldsUsed: string[];
  missingOptionalFields: string[];
  missingCriticalFields: string[];
} {
  const sourceNativeFieldsUsed = new Set<string>();
  for (const [group, origins] of Object.entries(rebuilt.evidenceByFieldGroup ?? {})) {
    for (const origin of origins) {
      if (
        origin.includes('db') ||
        origin.includes('canonical_fallback') ||
        origin.includes('existing_event')
      ) {
        continue;
      }
      sourceNativeFieldsUsed.add(`${group}:${origin}`);
    }
  }

  const canonicalSelfDerived = contributions
    .filter((c) => c.bundle.criticalIdentitySelfDerived)
    .map((c) => c.sourceId);

  const missingOptional = rebuilt.missingOptionalFields ?? [];
  const missingCritical: string[] = [];
  if (!rebuilt.title) missingCritical.push('title');
  if (!rebuilt.startDate) missingCritical.push('startDate');
  if (!rebuilt.venueName && !rebuilt.cityName && !rebuilt.venueCity) {
    missingCritical.push('venueOrCity');
  }
  if (!rebuilt.verifiedAt) missingCritical.push('verifiedAt');

  return {
    dbFallbackFieldsUsed: [],
    canonicalSelfDerivedFieldsUsed: canonicalSelfDerived,
    sourceNativeFieldsUsed: [...sourceNativeFieldsUsed],
    missingOptionalFields: missingOptional,
    missingCriticalFields: missingCritical,
  };
}
