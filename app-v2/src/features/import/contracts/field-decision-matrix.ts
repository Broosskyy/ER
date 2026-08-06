import { SOURCE_FIELD_OWNERSHIP_MATRIX } from '@/features/events/domain/source-field-ownership-matrix';

export type FieldDecisionRule = {
  field: string;
  eligibleSourceRoles: string[];
  mergeRule: string;
  explicitBeatsInferred: boolean;
  reviewThreshold: number;
  neverDowngrade: boolean;
  notes: string;
};

/**
 * Central field decision contract — merge engine owns truth, not importers.
 * Derived from SOURCE_FIELD_OWNERSHIP_MATRIX plus Phase 4.8.1 hard rules.
 */
export const PHASE481_FIELD_DECISION_RULES: FieldDecisionRule[] = [
  ...SOURCE_FIELD_OWNERSHIP_MATRIX.map((entry) => ({
    field: entry.field,
    eligibleSourceRoles: [
      entry.ownerTier === 'ticket_platform' ? 'ticket_platform' : 'official_website_source',
      'checkout_provider',
      'organizer',
      'venue',
    ],
    mergeRule: entry.mergeRule,
    explicitBeatsInferred: true,
    reviewThreshold: 0.65,
    neverDowngrade: entry.mergeRule === 'never_downgrade',
    notes: entry.notes,
  })),
  {
    field: 'ticketUrl',
    eligibleSourceRoles: ['ticket_platform', 'official_website_source'],
    mergeRule: 'event_specific_beats_shop_root',
    explicitBeatsInferred: true,
    reviewThreshold: 0.7,
    neverDowngrade: true,
    notes: 'Event-specific ticket URL beats shop root. Ticket Kings public event page preferred consumer CTA over Nacht-Manager.',
  },
  {
    field: 'priceText',
    eligibleSourceRoles: ['checkout_provider', 'ticket_platform', 'ticket_shop_list_row'],
    mergeRule: 'explicit_public_beats_inferred',
    explicitBeatsInferred: true,
    reviewThreshold: 0.75,
    neverDowngrade: false,
    notes: 'Nacht-Manager supplements price/phases; admission products exclude Flex/add-ons.',
  },
  {
    field: 'lineup',
    eligibleSourceRoles: ['official_website_source', 'organizer', 'ticket_platform'],
    mergeRule: 'structured_beats_prose',
    explicitBeatsInferred: true,
    reviewThreshold: 0.7,
    neverDowngrade: false,
    notes: 'Structured lineup evidence beats prose. Title inference disabled. No related-events sidebar.',
  },
  {
    field: 'venueName',
    eligibleSourceRoles: ['venue', 'official_website_source', 'organizer'],
    mergeRule: 'explicit_external_venue_beats_source_default',
    explicitBeatsInferred: true,
    reviewThreshold: 0.7,
    neverDowngrade: true,
    notes: 'Explicit external venue beats source-level default venue contamination.',
  },
];

export function getFieldDecisionRule(field: string): FieldDecisionRule | undefined {
  return PHASE481_FIELD_DECISION_RULES.find((r) => r.field === field);
}
