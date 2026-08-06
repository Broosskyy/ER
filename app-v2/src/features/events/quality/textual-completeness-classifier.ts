import { isDetailFetchBlocked } from '@/features/events/domain/blocked-origin-guard';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';

export type TextualCompletenessClass =
  | 'A_complete_from_textual'
  | 'B_partial_textual_improvement_possible'
  | 'C_only_flyer_remains'
  | 'D_source_has_no_additional_info'
  | 'E_textual_exists_but_inaccessible';

export interface TextualCompletenessInput {
  hasLineup: boolean;
  hasDescription: boolean;
  hasGenres: boolean;
  hasAttributes: boolean;
  hasAddress: boolean;
  hasCoordinates: boolean;
  hasTimetable: boolean;
  hasRunningOrder: boolean;
  hasArtwork: boolean;
  detailBlocked: boolean;
  importHasUnmergedTextualData: boolean;
  parserSignalsAvailable: boolean;
}

export interface TextualCompletenessAssessment {
  class: TextualCompletenessClass;
  reason: string;
  missingFields: string[];
}

const CORE_FIELDS = ['lineup', 'description'] as const;

export function assessTextualCompleteness(
  input: TextualCompletenessInput,
): TextualCompletenessAssessment {
  const missingFields: string[] = [];
  if (!input.hasLineup) missingFields.push('lineup');
  if (!input.hasDescription) missingFields.push('description');
  if (!input.hasGenres) missingFields.push('genres');
  if (!input.hasAttributes) missingFields.push('attributes');
  if (!input.hasAddress) missingFields.push('address');
  if (!input.hasCoordinates) missingFields.push('coordinates');
  if (!input.hasTimetable) missingFields.push('timetable');
  if (!input.hasRunningOrder) missingFields.push('runningOrder');

  if (missingFields.length === 0) {
    return {
      class: 'A_complete_from_textual',
      reason: 'all_tracked_textual_fields_present',
      missingFields: [],
    };
  }

  if (
    input.detailBlocked &&
    missingFields.some((field) =>
      ['lineup', 'description', 'timetable', 'runningOrder', 'genres', 'attributes'].includes(field),
    )
  ) {
    return {
      class: 'E_textual_exists_but_inaccessible',
      reason: 'ticket_platform_detail_blocked_official_detail_likely_exists',
      missingFields,
    };
  }

  if (input.detailBlocked && input.importHasUnmergedTextualData) {
    return {
      class: 'E_textual_exists_but_inaccessible',
      reason: 'ticket_platform_detail_blocked_but_origin_has_textual_signals',
      missingFields,
    };
  }

  if (input.parserSignalsAvailable || input.importHasUnmergedTextualData) {
    return {
      class: 'B_partial_textual_improvement_possible',
      reason: 'textual_signals_exist_but_not_fully_projected',
      missingFields,
    };
  }

  if (
    input.hasArtwork &&
    CORE_FIELDS.some((field) => missingFields.includes(field)) &&
    !input.detailBlocked
  ) {
    return {
      class: 'C_only_flyer_remains',
      reason: 'official_artwork_available_textual_sources_exhausted',
      missingFields,
    };
  }

  if (!input.hasArtwork && missingFields.length >= CORE_FIELDS.length) {
    return {
      class: 'D_source_has_no_additional_info',
      reason: 'no_additional_official_textual_or_artwork_signals',
      missingFields,
    };
  }

  if (input.hasArtwork) {
    return {
      class: 'C_only_flyer_remains',
      reason: 'remaining_gaps_require_flyer_fallback',
      missingFields,
    };
  }

  return {
    class: 'D_source_has_no_additional_info',
    reason: 'partial_canonical_without_flyer_candidate',
    missingFields,
  };
}

export function buildTextualCompletenessInputFromLayers(input: {
  canonical: Record<string, unknown>;
  importLayers: Array<{
    metadata?: Record<string, unknown>;
    fields: Record<string, unknown>;
  }>;
  hasArtwork?: boolean;
}): TextualCompletenessInput {
  const textualMeta = (layer: { metadata?: Record<string, unknown> }) => {
    const meta = layer.metadata ?? {};
    const textual = (meta.textualEnrichment ?? {}) as Record<string, unknown>;
    return textual;
  };

  const importHasUnmergedTextualData = input.importLayers.some((layer) => {
    const meta = layer.metadata ?? {};
    const textual = textualMeta(layer);
    const warnings = Array.isArray(meta.warnings) ? meta.warnings : [];
    return (
      warnings.some((w) => typeof w === 'string' && w.startsWith('textual_')) ||
      hasMeaningfulEventValue(textual.runningOrder) ||
      hasMeaningfulEventValue(textual.timetable) ||
      hasMeaningfulEventValue(textual.attributes) ||
      hasMeaningfulEventValue(layer.fields.lineup)
    );
  });

  const parserSignalsAvailable = input.importLayers.some((layer) => {
    const warnings = Array.isArray(layer.metadata?.warnings) ? layer.metadata!.warnings : [];
    return warnings.some(
      (w) =>
        typeof w === 'string' &&
        (w.startsWith('textual_') || w.startsWith('cross_source_ticket_link')),
    );
  });

  const detailBlocked = input.importLayers.some((layer) => isDetailFetchBlocked(layer.metadata));

  return {
    hasLineup: hasMeaningfulEventValue(input.canonical.lineup),
    hasDescription: hasMeaningfulEventValue(input.canonical.description),
    hasGenres: hasMeaningfulEventValue(input.canonical.genreLabels),
    hasAttributes: hasMeaningfulEventValue(input.canonical.attributes),
    hasAddress: hasMeaningfulEventValue(input.canonical.venueAddress),
    hasCoordinates: hasMeaningfulEventValue(input.canonical.coordinates),
    hasTimetable: hasMeaningfulEventValue(input.canonical.timetable),
    hasRunningOrder: hasMeaningfulEventValue(input.canonical.runningOrder),
    hasArtwork: input.hasArtwork ?? hasMeaningfulEventValue(input.canonical.imageUrl),
    detailBlocked,
    importHasUnmergedTextualData,
    parserSignalsAvailable,
  };
}
