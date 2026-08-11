import type { CanonicalEvent, EventEvidence } from './event-evidence';
import type { IdentityResolution } from './identity-resolver';

function firstValue<T>(
  evidence: EventEvidence[],
  read: (entry: EventEvidence) => T | undefined,
): T | undefined {
  for (const entry of evidence) {
    const value = read(entry);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/** Builds only from accepted evidence; no canonical-row or DB fallback is available. */
export class CanonicalEventBuilder {
  build(resolution: IdentityResolution): CanonicalEvent | undefined {
    const anchor = resolution.identityAnchor ?? resolution.official;
    if (!anchor) {
      return undefined;
    }

    const officialEntries = resolution.acceptedEvidence.filter(
      (entry) => entry.sourceFamily === 'official_website',
    );
    const ticketEvidence = resolution.acceptedEvidence.filter(
      (entry) => entry.sourceFamily !== 'official_website',
    );
    const contentSources =
      officialEntries.length > 0 ? officialEntries : [anchor];
    const title = anchor.identity.title?.value;
    const startDate = anchor.identity.startDate?.value;
    const venueName = anchor.identity.venueName?.value;
    if (!title || !startDate || !venueName) {
      return undefined;
    }

    const websiteUrl = firstValue(
      officialEntries,
      (entry) => entry.identity.officialWebsiteUrl?.value,
    );

    return {
      title,
      startDate,
      endDate: anchor.identity.endDate?.value,
      venueName,
      locationText: anchor.identity.locationText?.value,
      websiteUrl,
      description: firstValue(contentSources, (entry) => entry.content.description?.value),
      genres: firstValue(contentSources, (entry) => entry.content.genres?.value),
      lineup: firstValue(contentSources, (entry) => entry.content.lineup?.value),
      lineupState: firstValue(contentSources, (entry) => entry.content.lineupState?.value),
      lineupReason: firstValue(contentSources, (entry) => entry.content.lineupReason?.value),
      minimumAge: firstValue(contentSources, (entry) => entry.content.minimumAge?.value),
      venueEnvironment: firstValue(
        contentSources,
        (entry) => entry.content.venueEnvironment?.value,
      ),
      ticketUrl: firstValue(
        ticketEvidence.length > 0 ? ticketEvidence : resolution.acceptedEvidence,
        (entry) => entry.tickets.publicTicketUrl?.value,
      ),
      checkoutEvidenceUrl: firstValue(ticketEvidence, (entry) => entry.tickets.checkoutEvidenceUrl?.value),
      admissionPrice: firstValue(ticketEvidence, (entry) => entry.tickets.admissionPrice?.value),
      ticketPhases: firstValue(ticketEvidence, (entry) => entry.tickets.ticketPhases?.value),
      ticketStatus: firstValue(ticketEvidence, (entry) => entry.tickets.ticketStatus?.value),
    };
  }
}
