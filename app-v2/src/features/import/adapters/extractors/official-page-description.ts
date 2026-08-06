import {
  extractEventDescription,
  mapDescriptionSourceForLegacy,
  type LegacyDescriptionSource,
} from '@/features/import/unified-website';

export type OfficialDescriptionSource = LegacyDescriptionSource;

export interface OfficialPageDescriptionResult {
  description?: string;
  source: OfficialDescriptionSource;
  rejectedShortMeta?: string;
  contaminationRejected: boolean;
}

/**
 * Generic official event-page description extraction.
 * Prefers visible event body over short meta/OG snippets.
 */
export function extractOfficialPageDescription(html: string): OfficialPageDescriptionResult {
  const result = extractEventDescription(html);
  return {
    description: result.description,
    source: mapDescriptionSourceForLegacy(result.source),
    rejectedShortMeta: result.rejectedShortMeta,
    contaminationRejected: result.contaminationRejected,
  };
}
