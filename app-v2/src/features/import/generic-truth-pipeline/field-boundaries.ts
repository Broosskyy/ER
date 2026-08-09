import type { AdminEventRecord } from '@/data/types/records';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import type { EvidenceType, SourceRole } from '@/features/import/contracts/evidence-types';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';

import type { GenericTruthFieldGroup, SourceEvidenceBundle } from './source-evidence-contract';

export const FIELD_BLOCKED_OFFICIAL_WEBSITE =
  'field_blocked:source_role_not_allowed_for_official_website';

/** Fields the tickets field-group may change in generic truth publish. */
export const TICKETS_PATCH_FIELDS: readonly (keyof ImportPublishFieldPatch)[] = [
  'priceText',
  'ticketStatus',
  'ticketPhases',
];

/** Fields the cta_checkout field-group may change. */
export const CTA_CHECKOUT_PATCH_FIELDS: readonly (keyof ImportPublishFieldPatch)[] = ['ticketUrl'];

/** Official website field — not owned by ticket or CTA groups. */
export const OFFICIAL_WEBSITE_PATCH_FIELDS: readonly (keyof ImportPublishFieldPatch)[] = [
  'websiteUrl',
];

const SOURCE_ROLES_OFFICIAL_WEBSITE: readonly SourceRole[] = [
  'official_website_source',
  'organizer',
  'promoter',
  'venue',
];

const EVIDENCE_TYPES_OFFICIAL_WEBSITE: readonly EvidenceType[] = [
  'official_event_page',
  'html_text',
  'json_ld',
  'embedded_json',
];

const TICKET_EVIDENCE_DESTINATION_CLASSES = new Set([
  'ticket_platform_event',
  'ticket_platform_root',
  'ticket_platform_listing',
  'embedded_checkout_evidence',
  'direct_purchase',
]);

export function isOfficialWebsiteDestination(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  const classified = classifyTicketDestination(url);
  return (
    classified.destinationClass === 'official_event_page' ||
    classified.destinationClass === 'organizer_or_venue_homepage'
  );
}

/**
 * URL role classification — ticket/checkout destinations are never official website evidence.
 */
export function isTicketEvidenceDestination(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  const classified = classifyTicketDestination(url);
  if (classified.destinationClass === 'organizer_or_venue_homepage') {
    return false;
  }
  if (TICKET_EVIDENCE_DESTINATION_CLASSES.has(classified.destinationClass)) {
    return true;
  }
  return Boolean(classified.ticketPlatform);
}

export function canBundleProposeOfficialWebsite(bundle: SourceEvidenceBundle): boolean {
  const evidenceType = bundle.provenance?.evidenceType;
  if (
    SOURCE_ROLES_OFFICIAL_WEBSITE.includes(bundle.sourceRole) &&
    evidenceType &&
    EVIDENCE_TYPES_OFFICIAL_WEBSITE.includes(evidenceType)
  ) {
    return true;
  }
  if (
    bundle.identity.officialOutboundRelationship === 'linked' ||
    bundle.identity.officialOutboundRelationship === 'same_host'
  ) {
    return evidenceType === 'official_event_page' || evidenceType === 'html_text';
  }
  return false;
}

export function shouldBlockWebsiteUrlPatch(input: {
  proposedUrl: string | undefined;
  existingUrl: string | undefined;
  bundle: SourceEvidenceBundle;
}): boolean {
  const proposed = input.proposedUrl?.trim();
  if (!proposed) return false;
  const existing = input.existingUrl?.trim();
  if (proposed === existing) return false;

  if (isTicketEvidenceDestination(proposed) && !isOfficialWebsiteDestination(proposed)) {
    return true;
  }

  return !canBundleProposeOfficialWebsite(input.bundle);
}

export function filterPatchByFieldBoundaries(input: {
  patch: ImportPublishFieldPatch;
  existing: AdminEventRecord;
  bundle: SourceEvidenceBundle;
  allowedFieldGroups?: readonly GenericTruthFieldGroup[];
}): {
  patch: ImportPublishFieldPatch;
  blockedFields: Partial<Record<keyof ImportPublishFieldPatch, string>>;
  diagnostics: string[];
} {
  const filtered: ImportPublishFieldPatch = { ...input.patch };
  const blockedFields: Partial<Record<keyof ImportPublishFieldPatch, string>> = {};
  const diagnostics: string[] = [];

  if (filtered.websiteUrl !== undefined) {
    if (
      shouldBlockWebsiteUrlPatch({
        proposedUrl: filtered.websiteUrl,
        existingUrl: input.existing.websiteUrl,
        bundle: input.bundle,
      })
    ) {
      delete filtered.websiteUrl;
      blockedFields.websiteUrl = FIELD_BLOCKED_OFFICIAL_WEBSITE;
      diagnostics.push(FIELD_BLOCKED_OFFICIAL_WEBSITE);
    } else if (
      input.allowedFieldGroups &&
      !input.allowedFieldGroups.includes('identity_schedule_venue')
    ) {
      delete filtered.websiteUrl;
      blockedFields.websiteUrl = 'restricted_canary_scope';
      diagnostics.push('websiteUrl:blocked_by_restricted_canary_scope');
    }
  }

  for (const field of TICKETS_PATCH_FIELDS) {
    if (filtered[field] === undefined) continue;
    if (input.allowedFieldGroups && !input.allowedFieldGroups.includes('tickets')) {
      delete filtered[field];
      blockedFields[field] = 'restricted_canary_scope';
    }
  }

  if (filtered.ticketUrl !== undefined) {
    if (input.allowedFieldGroups && !input.allowedFieldGroups.includes('cta_checkout')) {
      delete filtered.ticketUrl;
      blockedFields.ticketUrl = 'restricted_canary_scope';
    }
  }

  return { patch: filtered, blockedFields, diagnostics };
}
