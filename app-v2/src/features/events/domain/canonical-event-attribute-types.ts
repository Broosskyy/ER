/** Canonical event attribute domain — Phase 4.7.3 */

export type EventAttributeDomain =
  | 'venue_environment'
  | 'event_type'
  | 'structure'
  | 'visitor_info';

export type VenueEnvironmentAttributeType =
  | 'indoor'
  | 'outdoor'
  | 'indoor_outdoor'
  | 'open_air'
  | 'rooftop'
  | 'beach'
  | 'boat'
  | 'warehouse'
  | 'club'
  | 'festival_site';

export type EventTypeAttributeType =
  | 'festival'
  | 'afterhour'
  | 'day_event'
  | 'night_event'
  | 'weekender'
  | 'live'
  | 'showcase'
  | 'special_event'
  | 'anniversary'
  | 'closing'
  | 'opening';

export type StructureAttributeType = 'floor_count' | 'stage_count';

export type VisitorInfoAttributeType =
  | 'minimum_age'
  | 'doors_open_at'
  | 'last_entry'
  | 'dress_code'
  | 'accessibility';

export type EventAttributeType =
  | VenueEnvironmentAttributeType
  | EventTypeAttributeType
  | StructureAttributeType
  | VisitorInfoAttributeType;

export type VenueEnvironmentValue = 'indoor' | 'outdoor' | 'hybrid';

export interface EventAttributeProvenance {
  sourceId?: string;
  sourceName?: string;
  origin?: string;
  extractionStrategy: string;
  rawEvidence?: string;
  context?: string;
  mergedAt?: string;
  origins?: string[];
}

export interface EventAttributeCandidate {
  type: EventAttributeType;
  normalizedValue?: string | number | boolean;
  label: string;
  domain: EventAttributeDomain;
  rawEvidence?: string;
  extractionStrategy: string;
  source: string;
  origin: string;
  confidence: number;
  provenance: EventAttributeProvenance;
  context?: string;
  explicit?: boolean;
}

export interface CanonicalEventAttribute {
  type: EventAttributeType;
  label: string;
  value?: string | number | boolean;
  domain: EventAttributeDomain;
  confidence: number;
  provenance: EventAttributeProvenance;
  reviewRequired?: boolean;
}

export interface CanonicalEventAttributeBundle {
  attributes: CanonicalEventAttribute[];
  floorCount?: number;
  stageCount?: number;
  venueEnvironment?: VenueEnvironmentValue;
  lastEntryAt?: string;
  dressCode?: string;
  accessibilityNotes?: string;
  reviewRequired?: boolean;
  conflicts?: Array<{ type: EventAttributeType; values: string[] }>;
}

export interface EventAttributeBadge {
  id: string;
  type: EventAttributeType;
  label: string;
  domain: EventAttributeDomain;
}

export const ATTRIBUTE_DOMAIN_BY_TYPE: Record<EventAttributeType, EventAttributeDomain> = {
  indoor: 'venue_environment',
  outdoor: 'venue_environment',
  indoor_outdoor: 'venue_environment',
  open_air: 'venue_environment',
  rooftop: 'venue_environment',
  beach: 'venue_environment',
  boat: 'venue_environment',
  warehouse: 'venue_environment',
  club: 'venue_environment',
  festival_site: 'venue_environment',
  festival: 'event_type',
  afterhour: 'event_type',
  day_event: 'event_type',
  night_event: 'event_type',
  weekender: 'event_type',
  live: 'event_type',
  showcase: 'event_type',
  special_event: 'event_type',
  anniversary: 'event_type',
  closing: 'event_type',
  opening: 'event_type',
  floor_count: 'structure',
  stage_count: 'structure',
  minimum_age: 'visitor_info',
  doors_open_at: 'visitor_info',
  last_entry: 'visitor_info',
  dress_code: 'visitor_info',
  accessibility: 'visitor_info',
};

export const FILTERABLE_ATTRIBUTE_TYPES: EventAttributeType[] = [
  'open_air',
  'festival',
  'boat',
  'live',
  'floor_count',
  'indoor',
  'outdoor',
  'minimum_age',
  'accessibility',
];

export const SEARCHABLE_ATTRIBUTE_LABELS: Record<string, string> = {
  open_air: 'Open Air',
  festival: 'Festival',
  boat: 'Boat',
  live: 'Live',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  floor_count: 'Floors',
  minimum_age: 'Age restriction',
  accessibility: 'Accessibility',
};
