/**
 * Phase 4.6.6 — Per-field multi-origin fallback order (source-agnostic).
 * Ticket platforms are modeled generically; no provider-specific merge rules.
 */

export type FieldEvidenceOrigin =
  | 'canonical_structured'
  | 'website_structured'
  | 'organizer_website'
  | 'venue_website'
  | 'ticket_platform_detail'
  | 'ticket_platform_list'
  | 'embedded_metadata'
  | 'structured_description'
  | 'flyer_extraction'
  | 'title_inference'
  | 'existing_canonical';

export interface FieldFallbackChain {
  field: string;
  priority: FieldEvidenceOrigin[];
  notes: string;
}

export const FIELD_FALLBACK_CHAINS: FieldFallbackChain[] = [
  {
    field: 'lineup',
    priority: [
      'canonical_structured',
      'website_structured',
      'ticket_platform_detail',
      'structured_description',
      'flyer_extraction',
      'title_inference',
    ],
    notes: 'Structured lineup beats title inference; flyer only after textual sources.',
  },
  {
    field: 'description',
    priority: [
      'website_structured',
      'organizer_website',
      'ticket_platform_detail',
      'structured_description',
      'embedded_metadata',
      'existing_canonical',
    ],
    notes: 'Official website prose wins; ticket list JSON-LD is not a downgrade target.',
  },
  {
    field: 'ticketUrl',
    priority: [
      'ticket_platform_detail',
      'ticket_platform_list',
      'website_structured',
      'existing_canonical',
    ],
    notes: 'Event-specific checkout URL beats shop root.',
  },
  {
    field: 'genreLabels',
    priority: [
      'website_structured',
      'ticket_platform_detail',
      'ticket_platform_list',
      'embedded_metadata',
      'existing_canonical',
    ],
    notes: 'Never replace populated genres with empty from blocked detail.',
  },
  {
    field: 'priceText',
    priority: [
      'ticket_platform_detail',
      'ticket_platform_list',
      'embedded_metadata',
      'existing_canonical',
    ],
    notes: 'Ticket platform pricing; list overview acceptable when detail blocked.',
  },
  {
    field: 'ticketPhases',
    priority: [
      'ticket_platform_detail',
      'ticket_platform_list',
      'embedded_metadata',
      'existing_canonical',
    ],
    notes: 'Multi-phase offers require detail HTML when available.',
  },
  {
    field: 'ticketStatus',
    priority: [
      'ticket_platform_detail',
      'ticket_platform_list',
      'embedded_metadata',
      'existing_canonical',
    ],
    notes: 'Sold-out / availability from ticket platform.',
  },
  {
    field: 'venueName',
    priority: ['venue_website', 'website_structured', 'ticket_platform_list', 'embedded_metadata', 'existing_canonical'],
    notes: 'Official venue identity over ticket shop defaults.',
  },
  {
    field: 'venueAddress',
    priority: ['venue_website', 'website_structured', 'ticket_platform_list', 'embedded_metadata', 'existing_canonical'],
    notes: 'Address from venue entity or list JSON-LD geo.',
  },
  {
    field: 'coordinates',
    priority: ['venue_website', 'website_structured', 'ticket_platform_list', 'embedded_metadata', 'existing_canonical'],
    notes: 'Geo from official or list JSON-LD.',
  },
  {
    field: 'doorsOpenAt',
    priority: ['website_structured', 'ticket_platform_detail', 'embedded_metadata', 'existing_canonical'],
    notes: 'Doors time from official or detail page.',
  },
  {
    field: 'ageRestriction',
    priority: ['website_structured', 'ticket_platform_detail', 'embedded_metadata', 'existing_canonical'],
    notes: 'Minimum age from detail attributes when available.',
  },
  {
    field: 'imageUrl',
    priority: ['website_structured', 'organizer_website', 'ticket_platform_list', 'existing_canonical'],
    notes: 'Official artwork preferred; used for flyer inventory when textual gaps remain.',
  },
  {
    field: 'badges',
    priority: ['website_structured', 'ticket_platform_detail', 'embedded_metadata', 'existing_canonical'],
    notes: 'Event attributes / badges from detail when fetch succeeds.',
  },
];

export function getFieldFallbackChain(field: string): FieldFallbackChain | undefined {
  return FIELD_FALLBACK_CHAINS.find((entry) => entry.field === field);
}

export function rankFieldEvidenceOrigin(field: string, origin: FieldEvidenceOrigin): number {
  const chain = getFieldFallbackChain(field);
  if (!chain) {
    return -1;
  }
  const index = chain.priority.indexOf(origin);
  return index === -1 ? -1 : chain.priority.length - index;
}

export function resolveImportOriginChannel(input: {
  sourceType?: string;
  connectorKey?: string;
  platform?: string;
  detailFetched?: boolean;
}): FieldEvidenceOrigin {
  if (
    input.connectorKey === 'ticket_platform' ||
    input.sourceType === 'ticket_platform' ||
    input.platform
  ) {
    return input.detailFetched ? 'ticket_platform_detail' : 'ticket_platform_list';
  }
  if (input.connectorKey === 'club_website') {
    return 'venue_website';
  }
  if (input.connectorKey === 'organizer_website' || input.sourceType === 'website') {
    return 'website_structured';
  }
  return 'embedded_metadata';
}
