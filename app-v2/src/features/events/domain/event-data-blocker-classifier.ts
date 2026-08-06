/**
 * Phase 4.6.5 — Exact blocker taxonomy (no generic unknown).
 */

import { isDetailFetchBlocked, resolveDetailFetchBlockReason } from '@/features/events/domain/blocked-origin-guard';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';

export type EventDataBlockerClass =
  | 'external_security_limitation'
  | 'source_has_no_data'
  | 'parser_limitation'
  | 'merge_limitation'
  | 'publish_limitation'
  | 'projection_limitation'
  | 'awaiting_flyer_enrichment';

export interface EventFieldGap {
  field: string;
  blocker: EventDataBlockerClass;
  detail: string;
}

export interface EventBlockerAssessment {
  eventId: string;
  title: string;
  gaps: EventFieldGap[];
  primaryBlocker: EventDataBlockerClass;
}

export function classifyFieldGap(input: {
  field: string;
  canonicalPresent: boolean;
  importPresent: boolean;
  detailBlocked?: boolean;
  hasArtwork?: boolean;
  parserInvoked?: boolean;
  mergeRejected?: boolean;
}): EventFieldGap | null {
  if (input.canonicalPresent) {
    return null;
  }

  if (input.detailBlocked && ['lineup', 'description', 'genreLabels', 'ticketPhases'].includes(input.field)) {
    return {
      field: input.field,
      blocker: 'external_security_limitation',
      detail: `detail_fetch_${resolveDetailFetchBlockReason({ detailEnrichment: { skippedReason: 'pow_blocked' } })}`,
    };
  }

  if (!input.importPresent && !input.hasArtwork) {
    return {
      field: input.field,
      blocker: 'source_has_no_data',
      detail: 'no_origin_supplies_field',
    };
  }

  if (input.importPresent && !input.parserInvoked && input.field === 'lineup') {
    return {
      field: input.field,
      blocker: 'parser_limitation',
      detail: 'structured_lineup_not_extracted_from_available_html',
    };
  }

  if (input.mergeRejected) {
    return {
      field: input.field,
      blocker: 'merge_limitation',
      detail: 'quality_gate_or_tier_rejected_incoming',
    };
  }

  if (input.hasArtwork && ['lineup', 'description'].includes(input.field)) {
    return {
      field: input.field,
      blocker: 'awaiting_flyer_enrichment',
      detail: 'official_artwork_available_textual_sources_exhausted',
    };
  }

  return {
    field: input.field,
    blocker: 'publish_limitation',
    detail: 'field_not_projected_to_canonical',
  };
}

export function assessEventBlockers(input: {
  eventId: string;
  title: string;
  canonical: Record<string, unknown>;
  importLayers: Array<{
    sourceId: string;
    metadata?: Record<string, unknown>;
    fields: Record<string, unknown>;
  }>;
  mergeRejectedFields?: string[];
}): EventBlockerAssessment {
  const trackedFields = [
    'description',
    'lineup',
    'genreLabels',
    'ticketUrl',
    'priceText',
    'ticketPhases',
    'venueAddress',
    'coordinates',
  ];

  const gaps: EventFieldGap[] = [];
  const anyDetailBlocked = input.importLayers.some((layer) => isDetailFetchBlocked(layer.metadata));

  for (const field of trackedFields) {
    const canonicalPresent = hasMeaningfulEventValue(input.canonical[field]);
    const importPresent = input.importLayers.some((layer) =>
      hasMeaningfulEventValue(layer.fields[field]),
    );
    const gap = classifyFieldGap({
      field,
      canonicalPresent,
      importPresent,
      detailBlocked: anyDetailBlocked,
      hasArtwork: hasMeaningfulEventValue(input.canonical.imageUrl),
      parserInvoked: input.importLayers.some(
        (layer) => layer.metadata?.detailEnrichment && (layer.metadata.detailEnrichment as Record<string, unknown>).parserInvoked === true,
      ),
      mergeRejected: input.mergeRejectedFields?.includes(field),
    });
    if (gap) {
      gaps.push(gap);
    }
  }

  const priority: EventDataBlockerClass[] = [
    'external_security_limitation',
    'source_has_no_data',
    'parser_limitation',
    'merge_limitation',
    'publish_limitation',
    'projection_limitation',
    'awaiting_flyer_enrichment',
  ];

  const primaryBlocker =
    priority.find((blocker) => gaps.some((gap) => gap.blocker === blocker)) ?? 'source_has_no_data';

  return { eventId: input.eventId, title: input.title, gaps, primaryBlocker };
}
