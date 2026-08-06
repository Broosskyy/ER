import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import { buildEventAttributeCandidatesFromImport } from './event-attribute-candidates';
import {
  buildCanonicalAttributeBundleFromImport,
  parseCanonicalEventAttributes,
} from './event-attribute-merge';
import { projectEventAttributeBadges } from './event-attribute-badge-projection';
import type { CanonicalEventAttribute } from './canonical-event-attribute-types';

export type AttributePipelineStage =
  | 'none'
  | 'evidence_absent'
  | 'not_extracted'
  | 'lost_in_normalization'
  | 'rejected_by_merge'
  | 'schema_column_missing'
  | 'not_persisted'
  | 'api_omitted'
  | 'view_model_omitted'
  | 'review_required';

export interface AttributeQualityViolation {
  rule: string;
  eventId: string;
  title: string;
  stage: AttributePipelineStage;
  evidence?: string;
  detail?: string;
}

export function auditEventAttributeQuality(input: {
  event: AdminEventRecord;
  candidate?: CanonicalImportEvent;
}): AttributeQualityViolation[] {
  const violations: AttributeQualityViolation[] = [];
  const bundle = input.candidate
    ? buildCanonicalAttributeBundleFromImport({ candidate: input.candidate, existing: input.event })
    : undefined;
  const incoming = input.candidate ? buildEventAttributeCandidatesFromImport(input.candidate) : [];
  const persisted = parseCanonicalEventAttributes(input.event.eventAttributes);
  const badges = projectEventAttributeBadges(persisted, {
    floorCount: input.event.floorCount,
    stageCount: input.event.stageCount,
  });

  if (incoming.length > 0 && persisted.length === 0 && input.event.eventAttributes === undefined) {
    violations.push({
      rule: 'explicit_source_attribute_not_persisted',
      eventId: input.event.id,
      title: input.event.title,
      stage: 'schema_column_missing',
      evidence: incoming.map((entry) => entry.type).join(', '),
    });
  }

  if (bundle?.reviewRequired) {
    violations.push({
      rule: 'conflicting_explicit_attribute_origins',
      eventId: input.event.id,
      title: input.event.title,
      stage: 'review_required',
      detail: JSON.stringify(bundle.conflicts ?? []),
    });
  }

  const duplicateTypes = new Set<string>();
  for (const attribute of persisted) {
    if (duplicateTypes.has(attribute.type)) {
      violations.push({
        rule: 'duplicate_canonical_attribute',
        eventId: input.event.id,
        title: input.event.title,
        stage: 'rejected_by_merge',
        detail: attribute.type,
      });
    }
    duplicateTypes.add(attribute.type);
  }

  for (const attribute of persisted) {
    if (!attribute.provenance?.extractionStrategy) {
      violations.push({
        rule: 'canonical_attribute_missing_provenance',
        eventId: input.event.id,
        title: input.event.title,
        stage: 'not_persisted',
        detail: attribute.type,
      });
    }
  }

  if (persisted.length > 0 && badges.length === 0) {
    violations.push({
      rule: 'canonical_attribute_without_badge_projection',
      eventId: input.event.id,
      title: input.event.title,
      stage: 'view_model_omitted',
    });
  }

  if (badges.length > 0 && persisted.length === 0) {
    violations.push({
      rule: 'badge_without_canonical_evidence',
      eventId: input.event.id,
      title: input.event.title,
      stage: 'api_omitted',
    });
  }

  const environmentTypes = persisted.filter((attribute) =>
    ['indoor', 'outdoor', 'indoor_outdoor', 'open_air'].includes(attribute.type),
  );
  if (environmentTypes.length > 2) {
    violations.push({
      rule: 'impossible_environment_combination',
      eventId: input.event.id,
      title: input.event.title,
      stage: 'review_required',
      detail: environmentTypes.map((entry) => entry.type).join(', '),
    });
  }

  return violations;
}

export function countEventsWithAttributeType(
  events: AdminEventRecord[],
  type: CanonicalEventAttribute['type'],
): number {
  return events.filter((event) =>
    parseCanonicalEventAttributes(event.eventAttributes).some((attribute) => attribute.type === type),
  ).length;
}
