import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { SourcedEventAttribute } from '@/features/aggregation/domain/event-structured-detail';
import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';

import {
  ATTRIBUTE_DOMAIN_BY_TYPE,
  type EventAttributeCandidate,
  type EventAttributeType,
  type VenueEnvironmentValue,
} from './canonical-event-attribute-types';

const LEGACY_KEY_MAP: Record<string, EventAttributeType> = {
  indoor: 'indoor',
  outdoor: 'outdoor',
  open_air: 'open_air',
  festival: 'festival',
  afterhour: 'afterhour',
  concert: 'live',
  multi_floor: 'floor_count',
  accessible: 'accessibility',
  club_night: 'night_event',
  day_rave: 'day_event',
};

const TITLE_DESCRIPTION_PATTERNS: Array<{
  pattern: RegExp;
  type: EventAttributeType;
  label: string;
  explicit?: boolean;
}> = [
  { pattern: /\bon a ship\b/i, type: 'boat', label: 'Boat' },
  { pattern: /\bship vol\b/i, type: 'boat', label: 'Boat' },
  { pattern: /\bopen\s*air\b/i, type: 'open_air', label: 'Open Air', explicit: true },
  { pattern: /\bweekender\b/i, type: 'weekender', label: 'Weekender' },
  { pattern: /\bshowcase\b/i, type: 'showcase', label: 'Showcase' },
  { pattern: /\brooftop\b/i, type: 'rooftop', label: 'Rooftop' },
  { pattern: /\bbeach\b/i, type: 'beach', label: 'Beach' },
  { pattern: /\bwarehouse\b/i, type: 'warehouse', label: 'Warehouse' },
];

function candidateFromLegacy(
  entry: SourcedEventAttribute,
  sourceName: string,
  sourceId?: string,
): EventAttributeCandidate | undefined {
  const type = LEGACY_KEY_MAP[entry.key];
  if (!type) {
    return undefined;
  }
  return {
    type,
    normalizedValue: entry.value ?? true,
    label: entry.label,
    domain: ATTRIBUTE_DOMAIN_BY_TYPE[type],
    rawEvidence: entry.label,
    extractionStrategy: 'legacy_sourced_event_attribute',
    source: sourceName,
    origin: entry.source,
    confidence: entry.confidence,
    context: entry.label,
    explicit: true,
    provenance: {
      sourceId,
      sourceName,
      origin: entry.source,
      extractionStrategy: 'legacy_sourced_event_attribute',
      rawEvidence: entry.label,
      context: entry.label,
    },
  };
}

function candidatesFromText(
  text: string | undefined,
  sourceName: string,
  sourceId?: string,
): EventAttributeCandidate[] {
  if (!text?.trim()) {
    return [];
  }
  const parsed = extractAttributesFromDescriptionText(text, sourceName);
  const candidates: EventAttributeCandidate[] = [];

  for (const attribute of parsed.attributes) {
    const mapped = candidateFromLegacy(attribute, sourceName, sourceId);
    if (mapped) {
      candidates.push(mapped);
    }
  }

  if (parsed.floorCount !== undefined) {
    candidates.push({
      type: 'floor_count',
      normalizedValue: parsed.floorCount,
      label: `${parsed.floorCount} Floors`,
      domain: 'structure',
      rawEvidence: `${parsed.floorCount} floors`,
      extractionStrategy: 'textual_attribute_parser',
      source: sourceName,
      origin: 'description_text',
      confidence: 0.85,
      explicit: true,
      provenance: {
        sourceId,
        sourceName,
        origin: 'description_text',
        extractionStrategy: 'textual_attribute_parser',
        rawEvidence: `${parsed.floorCount} floors`,
      },
    });
  }

  if (parsed.venueEnvironment) {
    const type: EventAttributeType =
      parsed.venueEnvironment === 'hybrid' ? 'indoor_outdoor' : parsed.venueEnvironment;
    candidates.push({
      type,
      normalizedValue: parsed.venueEnvironment,
      label: type === 'indoor_outdoor' ? 'Indoor & Outdoor' : type === 'indoor' ? 'Indoor' : 'Outdoor',
      domain: 'venue_environment',
      rawEvidence: parsed.venueEnvironment,
      extractionStrategy: 'textual_attribute_parser',
      source: sourceName,
      origin: 'description_text',
      confidence: 0.8,
      explicit: true,
      provenance: {
        sourceId,
        sourceName,
        origin: 'description_text',
        extractionStrategy: 'textual_attribute_parser',
        rawEvidence: parsed.venueEnvironment,
      },
    });
  }

  for (const pattern of TITLE_DESCRIPTION_PATTERNS) {
    if (pattern.pattern.test(text)) {
      candidates.push({
        type: pattern.type,
        normalizedValue: true,
        label: pattern.label,
        domain: ATTRIBUTE_DOMAIN_BY_TYPE[pattern.type],
        rawEvidence: text.match(pattern.pattern)?.[0],
        extractionStrategy: 'generic_text_pattern',
        source: sourceName,
        origin: 'title_or_description',
        confidence: pattern.explicit ? 0.9 : 0.75,
        explicit: pattern.explicit ?? false,
        provenance: {
          sourceId,
          sourceName,
          origin: 'title_or_description',
          extractionStrategy: 'generic_text_pattern',
          rawEvidence: text.match(pattern.pattern)?.[0],
        },
      });
    }
  }

  return candidates;
}

export function buildEventAttributeCandidatesFromImport(
  candidate: CanonicalImportEvent,
): EventAttributeCandidate[] {
  const metadata = (candidate.sourceMetadata ?? {}) as Record<string, unknown>;
  const sourceName = candidate.sourceName ?? candidate.sourceId ?? 'unknown';
  const sourceId = candidate.sourceId;
  const merged: EventAttributeCandidate[] = [];
  const seen = new Set<string>();

  const push = (entry: EventAttributeCandidate) => {
    const key = `${entry.type}:${String(entry.normalizedValue ?? '')}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(entry);
  };

  const legacyAttributes = metadata.eventAttributes;
  if (Array.isArray(legacyAttributes)) {
    for (const raw of legacyAttributes) {
      const mapped = candidateFromLegacy(raw as SourcedEventAttribute, sourceName, sourceId);
      if (mapped) {
        push(mapped);
      }
    }
  }

  const floorCount = metadata.floorCount;
  if (typeof floorCount === 'number' && Number.isFinite(floorCount)) {
    push({
      type: 'floor_count',
      normalizedValue: floorCount,
      label: `${floorCount} Floors`,
      domain: 'structure',
      rawEvidence: String(floorCount),
      extractionStrategy: 'connector_metadata_floor_count',
      source: sourceName,
      origin: 'sourceMetadata.floorCount',
      confidence: 0.9,
      explicit: true,
      provenance: {
        sourceId,
        sourceName,
        origin: 'sourceMetadata.floorCount',
        extractionStrategy: 'connector_metadata_floor_count',
        rawEvidence: String(floorCount),
      },
    });
  }

  const stageCount = metadata.stageCount;
  if (typeof stageCount === 'number' && Number.isFinite(stageCount)) {
    push({
      type: 'stage_count',
      normalizedValue: stageCount,
      label: `${stageCount} Stages`,
      domain: 'structure',
      rawEvidence: String(stageCount),
      extractionStrategy: 'connector_metadata_stage_count',
      source: sourceName,
      origin: 'sourceMetadata.stageCount',
      confidence: 0.9,
      explicit: true,
      provenance: {
        sourceId,
        sourceName,
        origin: 'sourceMetadata.stageCount',
        extractionStrategy: 'connector_metadata_stage_count',
        rawEvidence: String(stageCount),
      },
    });
  }

  const venueEnvironment = metadata.venueEnvironment as VenueEnvironmentValue | undefined;
  if (venueEnvironment === 'indoor' || venueEnvironment === 'outdoor' || venueEnvironment === 'hybrid') {
    const type: EventAttributeType = venueEnvironment === 'hybrid' ? 'indoor_outdoor' : venueEnvironment;
    push({
      type,
      normalizedValue: venueEnvironment,
      label: venueEnvironment === 'hybrid' ? 'Indoor & Outdoor' : venueEnvironment === 'indoor' ? 'Indoor' : 'Outdoor',
      domain: 'venue_environment',
      rawEvidence: venueEnvironment,
      extractionStrategy: 'connector_metadata_venue_environment',
      source: sourceName,
      origin: 'sourceMetadata.venueEnvironment',
      confidence: 0.85,
      explicit: true,
      provenance: {
        sourceId,
        sourceName,
        origin: 'sourceMetadata.venueEnvironment',
        extractionStrategy: 'connector_metadata_venue_environment',
        rawEvidence: venueEnvironment,
      },
    });
  }

  for (const entry of candidatesFromText(candidate.title, sourceName, sourceId)) {
    push(entry);
  }
  for (const entry of candidatesFromText(candidate.description, sourceName, sourceId)) {
    push(entry);
  }

  const dressCode = metadata.dressCode ?? metadata.dress_code;
  if (typeof dressCode === 'string' && dressCode.trim()) {
    push({
      type: 'dress_code',
      normalizedValue: dressCode.trim(),
      label: 'Dresscode',
      domain: 'visitor_info',
      rawEvidence: dressCode.trim(),
      extractionStrategy: 'connector_metadata_dress_code',
      source: sourceName,
      origin: 'sourceMetadata.dressCode',
      confidence: 0.85,
      explicit: true,
      provenance: {
        sourceId,
        sourceName,
        origin: 'sourceMetadata.dressCode',
        extractionStrategy: 'connector_metadata_dress_code',
        rawEvidence: dressCode.trim(),
      },
    });
  }

  return merged;
}
