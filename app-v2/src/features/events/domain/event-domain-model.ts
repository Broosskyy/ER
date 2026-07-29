/**
 * Event domain boundaries — Sprint 14 foundation.
 *
 * Source: data origin only (configuration + import provenance).
 * Organizer: entity that produces events; not interchangeable with Source.
 * Venue: physical or logical location; multiple events per venue.
 * Festival: series/edition format; events may link via festivalEditionId.
 * Event: canonical platform entity aggregating multi-source facts.
 */

export const EVENT_DOMAIN_ENTITIES = [
  'event',
  'source',
  'organizer',
  'venue',
  'festival',
] as const;

export type EventDomainEntity = (typeof EVENT_DOMAIN_ENTITIES)[number];
