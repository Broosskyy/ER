/**
 * Phase 4.8.1 — unified evidence and import channel types.
 * Staging-only contract definitions; importers never write canonical data directly.
 */

export const UNIFIED_IMPORT_CONTRACT_VERSION = 'phase481-v1';

export type ImportChannel = 'manual_admin_import' | 'automatic_source_import' | 'ai_assisted_import';

export type EvidenceType =
  | 'official_event_page'
  | 'ticket_platform_event_page'
  | 'ticket_shop_list_row'
  | 'checkout'
  | 'json_ld'
  | 'embedded_json'
  | 'html_text'
  | 'flyer'
  | 'manual_admin_evidence'
  | 'inferred_candidate'
  | 'legacy_compatibility_evidence';

export type SourceRole =
  | 'organizer'
  | 'promoter'
  | 'official_website_source'
  | 'ticket_platform'
  | 'checkout_provider'
  | 'venue'
  | 'discovery_source';

export type EvidenceReviewState = 'accepted' | 'pending' | 'rejected' | 'not_reviewed';

export type SupportedEventDomain =
  | 'identity'
  | 'title'
  | 'subtitle'
  | 'date_time'
  | 'venue'
  | 'location'
  | 'organizer'
  | 'promoter'
  | 'genre'
  | 'description'
  | 'flyer'
  | 'gallery'
  | 'lineup'
  | 'artists'
  | 'ticket_destination'
  | 'checkout'
  | 'price'
  | 'ticket_phases'
  | 'availability'
  | 'sold_out'
  | 'event_attributes';

export const EXPLICIT_EVIDENCE_TYPES: EvidenceType[] = [
  'official_event_page',
  'ticket_platform_event_page',
  'ticket_shop_list_row',
  'checkout',
  'json_ld',
  'embedded_json',
  'html_text',
  'flyer',
  'manual_admin_evidence',
];

export function isExplicitEvidenceType(type: EvidenceType): boolean {
  return EXPLICIT_EVIDENCE_TYPES.includes(type);
}
