import type { CanonicalEvent, EventEvidence } from '../event-evidence';
import type { ImportDraft } from '../import-draft';
import type { SourceEvent } from './source-event';

const FULL_ADDRESS_IN_CITY =
  /\b\d{5}\b|,\s*\d{5}|straße|str\.|ufer|weg|platz|allee|avenue|street\b/i;

function extractCityFromGermanAddress(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const postalCity = value.match(/,\s*\d{5},\s*([^,]+)/i);
  if (postalCity?.[1]?.trim()) return postalCity[1].trim();
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

function pickOfficialEvidence(evidence: EventEvidence[]): EventEvidence | undefined {
  return evidence.find((entry) => entry.sourceFamily === 'official_website');
}

function pickTicketEvidence(evidence: EventEvidence[]): EventEvidence | undefined {
  return evidence.find((entry) => entry.sourceFamily === 'ticket_io');
}

/** Role-aware SourceEvent assembly — official owns venue/identity, ticket owns admission only. */
export function resolveSourceEventFromDraft(draft: ImportDraft): SourceEvent | undefined {
  const event = draft.proposedCanonicalEvent;
  if (!event) return undefined;

  const official = pickOfficialEvidence(draft.evidence);
  const ticket = pickTicketEvidence(draft.evidence);
  const verifiedAt =
    official?.verifiedAt?.trim() ??
    ticket?.verifiedAt?.trim() ??
    draft.verifiedAt;

  const officialVenueName =
    official?.identity.venueName?.value ?? official?.identity.locationText?.value;
  const officialLocation = official?.identity.locationText?.value;
  const ticketLocation = ticket?.identity.locationText?.value;
  const venueAddress =
    (officialLocation && FULL_ADDRESS_IN_CITY.test(officialLocation) ? officialLocation : undefined) ??
    (ticketLocation && FULL_ADDRESS_IN_CITY.test(ticketLocation) ? ticketLocation : undefined);
  const venueCity =
    extractCityFromGermanAddress(officialLocation) ??
    extractCityFromGermanAddress(ticketLocation) ??
    (event.locationText && !FULL_ADDRESS_IN_CITY.test(event.locationText)
      ? event.locationText
      : undefined);

  return {
    title: official?.identity.title?.value ?? event.title,
    startDate: official?.identity.startDate?.value ?? event.startDate,
    endDate: official?.identity.endDate?.value ?? event.endDate,
    venueName: officialVenueName ?? event.venueName ?? event.locationText,
    venueAddress,
    venueCity,
    websiteUrl: official?.identity.officialWebsiteUrl?.value ?? event.websiteUrl,
    ticketUrl: ticket?.tickets.publicTicketUrl?.value ?? event.ticketUrl,
    description: official?.content.description?.value ?? event.description,
    genreLabels: official?.content.genres?.value ?? event.genres,
    lineup: event.lineup?.map((entry) => entry.displayName),
    minimumAge: official?.content.minimumAge?.value ?? event.minimumAge,
    ticketStatus: ticket?.tickets.ticketStatus?.value ?? event.ticketStatus,
    priceText: ticket?.tickets.admissionPrice?.value?.text ?? event.admissionPrice?.text,
    ticketPhases: ticket?.tickets.ticketPhases?.value ?? event.ticketPhases,
    verifiedAt,
  };
}

export function canonicalToSourceEvent(
  canonical: CanonicalEvent | undefined,
  evidence: EventEvidence[],
): SourceEvent | undefined {
  if (!canonical) return undefined;
  return resolveSourceEventFromDraft({
    id: 'legacy',
    submissionKind: 'automatic_source',
    submitter: { role: 'system' },
    sources: [],
    evidence,
    reviewTrack: 'quick_review',
    reviewReasons: [],
    duplicates: [],
    proposedFieldChanges: [],
    missingFields: [],
    fieldGroupConfidence: {
      identity: 'medium',
      genres: 'missing',
      lineup: 'missing',
      tickets: 'missing',
      description: 'missing',
      image: 'missing',
    },
    genres: { items: [], normalizedLabels: [], chipSuggestions: [], uncertainLabels: [] },
    audit: {
      productionMutations: 0,
      rolloutActivated: false,
      persistenceMode: 'dry_run_noop',
      coreDecision: 'review',
      provenanceSourceIds: [],
    },
    proposedCanonicalEvent: canonical,
    verifiedAt: evidence.map((entry) => entry.verifiedAt).find(Boolean),
  } as unknown as ImportDraft);
}
