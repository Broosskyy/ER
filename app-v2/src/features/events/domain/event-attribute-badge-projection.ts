import type {
  CanonicalEventAttribute,
  EventAttributeBadge,
  EventAttributeType,
} from './canonical-event-attribute-types';

const BADGE_LABEL_OVERRIDES: Partial<Record<EventAttributeType, string>> = {
  open_air: 'Open Air',
  indoor_outdoor: 'Indoor & Outdoor',
  floor_count: 'Multi Floor',
  stage_count: 'Multi Stage',
  live: 'Live',
  boat: 'Boat',
  festival: 'Festival',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  weekender: 'Weekender',
  afterhour: 'Afterhour',
};

const BADGE_EXCLUDED_TYPES = new Set<EventAttributeType>([
  'minimum_age',
  'doors_open_at',
  'last_entry',
  'dress_code',
  'accessibility',
]);

/** Consumer-facing attribute badges — excludes ticket status and editorial badges. */
export function projectEventAttributeBadges(
  attributes: CanonicalEventAttribute[] | undefined,
  options?: { floorCount?: number; stageCount?: number },
): EventAttributeBadge[] {
  const badges: EventAttributeBadge[] = [];
  const seen = new Set<EventAttributeType>();

  for (const attribute of attributes ?? []) {
    if (BADGE_EXCLUDED_TYPES.has(attribute.type)) {
      continue;
    }
    if (seen.has(attribute.type)) {
      continue;
    }
    if (attribute.reviewRequired) {
      continue;
    }
    seen.add(attribute.type);
    badges.push({
      id: `attr-${attribute.type}`,
      type: attribute.type,
      label: BADGE_LABEL_OVERRIDES[attribute.type] ?? attribute.label,
      domain: attribute.domain,
    });
  }

  if (options?.floorCount && options.floorCount > 1 && !seen.has('floor_count')) {
    badges.push({
      id: 'attr-floor_count',
      type: 'floor_count',
      label: `${options.floorCount} Floors`,
      domain: 'structure',
    });
  }

  if (options?.stageCount && options.stageCount > 1 && !seen.has('stage_count')) {
    badges.push({
      id: 'attr-stage_count',
      type: 'stage_count',
      label: `${options.stageCount} Stages`,
      domain: 'structure',
    });
  }

  return badges;
}

export function collectSearchableAttributeTerms(
  attributes: CanonicalEventAttribute[] | undefined,
  options?: { floorCount?: number },
): string[] {
  const terms = new Set<string>();
  for (const badge of projectEventAttributeBadges(attributes, { floorCount: options?.floorCount })) {
    terms.add(badge.label);
  }
  return [...terms];
}
