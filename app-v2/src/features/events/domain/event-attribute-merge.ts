import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import { buildEventAttributeCandidatesFromImport } from './event-attribute-candidates';
import type {
  CanonicalEventAttribute,
  CanonicalEventAttributeBundle,
  EventAttributeCandidate,
  EventAttributeType,
  VenueEnvironmentValue,
} from './canonical-event-attribute-types';

export function buildCanonicalAttributeBundleFromImport(input: {
  candidate: CanonicalImportEvent;
  existing?: AdminEventRecord | null;
}): CanonicalEventAttributeBundle {
  const incoming = buildEventAttributeCandidatesFromImport(input.candidate);
  const existing = parseCanonicalEventAttributes(input.existing?.eventAttributes);
  return mergeEventAttributeCandidates({ existing, incoming });
}

function scoreCandidate(candidate: EventAttributeCandidate): number {
  let score = candidate.confidence;
  if (candidate.explicit) {
    score += 0.15;
  }
  return score;
}

function mergeProvenance(
  existing: CanonicalEventAttribute['provenance'],
  incoming: EventAttributeCandidate,
): CanonicalEventAttribute['provenance'] {
  const origins = new Set([...(existing.origins ?? []), incoming.origin]);
  return {
    ...existing,
    sourceId: existing.sourceId ?? incoming.provenance.sourceId,
    sourceName: existing.sourceName ?? incoming.provenance.sourceName,
    origins: [...origins],
    mergedAt: new Date().toISOString(),
    rawEvidence: existing.rawEvidence ?? incoming.rawEvidence,
    context: existing.context ?? incoming.context,
  };
}

function toCanonical(candidate: EventAttributeCandidate): CanonicalEventAttribute {
  return {
    type: candidate.type,
    label: candidate.label,
    value: candidate.normalizedValue,
    domain: candidate.domain,
    confidence: candidate.confidence,
    provenance: {
      ...candidate.provenance,
      mergedAt: new Date().toISOString(),
      origins: [candidate.origin],
    },
  };
}

function deriveVenueEnvironment(
  attributes: CanonicalEventAttribute[],
): VenueEnvironmentValue | undefined {
  const types = new Set(attributes.map((attribute) => attribute.type));
  if (types.has('indoor_outdoor')) {
    return 'hybrid';
  }
  if (types.has('indoor') && types.has('outdoor')) {
    return 'hybrid';
  }
  if (types.has('open_air') || types.has('outdoor') || types.has('beach') || types.has('rooftop')) {
    return 'outdoor';
  }
  if (types.has('indoor') || types.has('club') || types.has('warehouse')) {
    return 'indoor';
  }
  return undefined;
}

function deriveScalarCounts(attributes: CanonicalEventAttribute[]): {
  floorCount?: number;
  stageCount?: number;
} {
  const floor = attributes.find((attribute) => attribute.type === 'floor_count');
  const stage = attributes.find((attribute) => attribute.type === 'stage_count');
  return {
    floorCount:
      typeof floor?.value === 'number'
        ? floor.value
        : typeof floor?.value === 'string'
          ? Number.parseInt(floor.value, 10)
          : undefined,
    stageCount:
      typeof stage?.value === 'number'
        ? stage.value
        : typeof stage?.value === 'string'
          ? Number.parseInt(stage.value, 10)
          : undefined,
  };
}

export function mergeEventAttributeCandidates(input: {
  existing?: CanonicalEventAttribute[];
  incoming: EventAttributeCandidate[];
}): CanonicalEventAttributeBundle {
  const byType = new Map<EventAttributeType, CanonicalEventAttribute>();
  const conflicts: Array<{ type: EventAttributeType; values: string[] }> = [];
  let reviewRequired = false;

  for (const existing of input.existing ?? []) {
    byType.set(existing.type, existing);
  }

  for (const candidate of input.incoming) {
    const current = byType.get(candidate.type);
    if (!current) {
      byType.set(candidate.type, toCanonical(candidate));
      continue;
    }

    const currentValue = String(current.value ?? current.label);
    const incomingValue = String(candidate.normalizedValue ?? candidate.label);
    if (currentValue !== incomingValue && candidate.explicit && current.provenance.origins?.length) {
      conflicts.push({
        type: candidate.type,
        values: [...new Set([currentValue, incomingValue])],
      });
      reviewRequired = true;
      continue;
    }

    if (scoreCandidate(candidate) >= current.confidence) {
      byType.set(candidate.type, {
        ...current,
        label: candidate.label,
        value: candidate.normalizedValue,
        confidence: Math.max(current.confidence, candidate.confidence),
        provenance: mergeProvenance(current.provenance, candidate),
      });
    } else {
      byType.set(candidate.type, {
        ...current,
        provenance: mergeProvenance(current.provenance, candidate),
        confidence: Math.min(1, current.confidence + 0.05),
      });
    }
  }

  const attributes = [...byType.values()].sort((left, right) => left.type.localeCompare(right.type));
  const { floorCount, stageCount } = deriveScalarCounts(attributes);
  const dressCodeAttr = attributes.find((attribute) => attribute.type === 'dress_code');
  const accessibilityAttr = attributes.find((attribute) => attribute.type === 'accessibility');

  return {
    attributes,
    floorCount,
    stageCount,
    venueEnvironment: deriveVenueEnvironment(attributes),
    dressCode: typeof dressCodeAttr?.value === 'string' ? dressCodeAttr.value : undefined,
    accessibilityNotes:
      typeof accessibilityAttr?.value === 'string'
        ? accessibilityAttr.value
        : accessibilityAttr?.label,
    reviewRequired: reviewRequired || undefined,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

export function parseCanonicalEventAttributes(value: unknown): CanonicalEventAttribute[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => entry && typeof entry === 'object') as CanonicalEventAttribute[];
}

export function serializeCanonicalEventAttributes(
  attributes: CanonicalEventAttribute[],
): CanonicalEventAttribute[] {
  return attributes.map((attribute) => ({
    type: attribute.type,
    label: attribute.label,
    value: attribute.value,
    domain: attribute.domain,
    confidence: attribute.confidence,
    provenance: attribute.provenance,
    reviewRequired: attribute.reviewRequired,
  }));
}
