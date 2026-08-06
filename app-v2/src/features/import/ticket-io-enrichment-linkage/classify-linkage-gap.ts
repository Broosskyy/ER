import type { TicketIoPriceEvidenceDiscovery } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { valuesSemanticallyEqual } from '@/features/import/shadow/official-website-public-truth';

import type { TicketIoLinkagePersistenceState, TicketIoLinkageRootCause } from './types';

export function classifyTicketIoLinkageGap(input: {
  hasTicketIoSourceReference: boolean;
  ticketIoImportCount: number;
  linkedImportCount: number;
  canonicalPriceText?: string;
  connectorPriceText?: string;
  discovery: TicketIoPriceEvidenceDiscovery;
  slugCollision: boolean;
  listRowMatch: boolean;
}): {
  rootCause: TicketIoLinkageRootCause;
  persistenceState: TicketIoLinkagePersistenceState;
  responsibleModule: string;
  responsibleTransition: string;
  repeatsWithoutFix: boolean;
  genericCodeChangeRequired: boolean;
  controlledEnrichmentSufficient: boolean;
} {
  const publicPrice = input.discovery.bestHit?.priceText?.trim();
  const hasPublicPrice = Boolean(publicPrice && publicPrice !== 'Ausverkauft');
  const hasCanonicalPrice = Boolean(input.canonicalPriceText?.trim());

  if (input.slugCollision) {
    return {
      rootCause: 'REVIEW_REQUIRED',
      persistenceState: 'review_required',
      responsibleModule: 'ticket-io-enrichment-linkage/resolve-enrichment-target',
      responsibleTransition: 'findSlugCollisions',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: false,
      controlledEnrichmentSufficient: false,
    };
  }

  if (!input.discovery.listAccessible) {
    return {
      rootCause: 'PUBLIC_EVIDENCE_MISSING',
      persistenceState: 'no_public_evidence',
      responsibleModule: 'ticket-io-price-evidence',
      responsibleTransition: 'discoverTicketIoPriceEvidence',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: false,
      controlledEnrichmentSufficient: false,
    };
  }

  if (!input.listRowMatch && !hasPublicPrice) {
    return {
      rootCause: 'LIST_ROW_MATCH_FAILED',
      persistenceState: 'no_public_evidence',
      responsibleModule: 'ticket-io-list-enrichment',
      responsibleTransition: 'parseAllTicketIoListRowContexts',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: false,
      controlledEnrichmentSufficient: false,
    };
  }

  if (!hasPublicPrice) {
    return {
      rootCause: 'PUBLIC_EVIDENCE_MISSING',
      persistenceState: 'no_public_evidence',
      responsibleModule: 'ticket-io-price-evidence',
      responsibleTransition: 'discoverTicketIoPriceEvidence.bestHit',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: false,
      controlledEnrichmentSufficient: false,
    };
  }

  if (input.discovery.detailAltchaBlocked && hasPublicPrice && !hasCanonicalPrice) {
    // Detail blocked but list evidence is sufficient — enrichment should use list path.
  }

  if (hasCanonicalPrice && input.connectorPriceText) {
    if (valuesSemanticallyEqual(input.canonicalPriceText, input.connectorPriceText)) {
      return {
        rootCause: 'NONE',
        persistenceState: 'linked_and_current',
        responsibleModule: 'canonical-ticket-writer',
        responsibleTransition: 'writeCanonicalTicketFields',
        repeatsWithoutFix: false,
        genericCodeChangeRequired: false,
        controlledEnrichmentSufficient: false,
      };
    }
    return {
      rootCause: 'CANONICAL_VALUE_STALE',
      persistenceState: 'linked_stale',
      responsibleModule: 'import-event-field-mapper',
      responsibleTransition: 'buildImportPublishFieldPatch.priceText',
      repeatsWithoutFix: !input.hasTicketIoSourceReference,
      genericCodeChangeRequired: !input.hasTicketIoSourceReference,
      controlledEnrichmentSufficient: true,
    };
  }

  if (!input.hasTicketIoSourceReference && input.ticketIoImportCount === 0) {
    return {
      rootCause: 'NO_TICKETIO_SOURCE_REFERENCE',
      persistenceState: 'unlinked_gap',
      responsibleModule: 'import-event-publish-service',
      responsibleTransition: 'EventOriginService.upsertFromPublish',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: true,
      controlledEnrichmentSufficient: true,
    };
  }

  if (input.ticketIoImportCount === 0) {
    return {
      rootCause: 'NO_TICKETIO_IMPORT_RECORD',
      persistenceState: 'unlinked_gap',
      responsibleModule: 'import-aggregation-service',
      responsibleTransition: 'executeExistingJob',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: false,
      controlledEnrichmentSufficient: true,
    };
  }

  if (input.linkedImportCount === 0) {
    return {
      rootCause: 'IMPORT_RECORD_NOT_LINKED_TO_CANONICAL_EVENT',
      persistenceState: 'unlinked_gap',
      responsibleModule: 'duplicate-detection-service',
      responsibleTransition: 'detect + resolveExistingEventId',
      repeatsWithoutFix: true,
      genericCodeChangeRequired: true,
      controlledEnrichmentSufficient: true,
    };
  }

  if (hasPublicPrice && !hasCanonicalPrice) {
    return {
      rootCause: 'VALID_EVIDENCE_NOT_PERSISTED',
      persistenceState: 'unlinked_gap',
      responsibleModule: 'canonical-ticket-writer',
      responsibleTransition: 'writeCanonicalTicketFields',
      repeatsWithoutFix: !input.hasTicketIoSourceReference,
      genericCodeChangeRequired: !input.hasTicketIoSourceReference,
      controlledEnrichmentSufficient: true,
    };
  }

  if (input.discovery.detailAltchaBlocked && hasPublicPrice) {
    return {
      rootCause: 'DETAIL_BLOCKED_LIST_SUFFICIENT',
      persistenceState: hasCanonicalPrice ? 'linked_and_current' : 'unlinked_gap',
      responsibleModule: 'ticket-io-price-strategy-registry',
      responsibleTransition: 'list_card_html strategy',
      repeatsWithoutFix: false,
      genericCodeChangeRequired: false,
      controlledEnrichmentSufficient: !hasCanonicalPrice,
    };
  }

  return {
    rootCause: 'REVIEW_REQUIRED',
    persistenceState: 'review_required',
    responsibleModule: 'ticket-io-enrichment-linkage',
    responsibleTransition: 'classifyTicketIoLinkageGap',
    repeatsWithoutFix: true,
    genericCodeChangeRequired: false,
    controlledEnrichmentSufficient: false,
  };
}
