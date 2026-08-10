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
    const official = resolution.official;
    if (!official) {
      return undefined;
    }

    const officialFirst = [
      official,
      ...resolution.acceptedEvidence.filter((entry) => entry !== official),
    ];
    const ticketEvidence = resolution.acceptedEvidence.filter(
      (entry) => entry.sourceFamily !== 'official_website',
    );
    const title = official.identity.title?.value;
    const startDate = official.identity.startDate?.value;
    const websiteUrl = official.identity.officialWebsiteUrl?.value;
    if (!title || !startDate || !websiteUrl) {
      return undefined;
    }

    return {
      title,
      startDate,
      endDate: official.identity.endDate?.value,
      venueName: official.identity.venueName?.value,
      locationText: official.identity.locationText?.value,
      websiteUrl,
      description: firstValue(
        officialFirst,
        (entry) => entry.content.description?.value,
      ),
      genres: firstValue(officialFirst, (entry) => entry.content.genres?.value),
      lineup: firstValue(officialFirst, (entry) => entry.content.lineup?.value),
      lineupState: firstValue(
        officialFirst,
        (entry) => entry.content.lineupState?.value,
      ),
      lineupReason: firstValue(
        officialFirst,
        (entry) => entry.content.lineupReason?.value,
      ),
      minimumAge: firstValue(
        officialFirst,
        (entry) => entry.content.minimumAge?.value,
      ),
      venueEnvironment: firstValue(
        officialFirst,
        (entry) => entry.content.venueEnvironment?.value,
      ),
      ticketUrl: firstValue(
        ticketEvidence,
        (entry) => entry.tickets.publicTicketUrl?.value,
      ),
      checkoutEvidenceUrl: firstValue(
        ticketEvidence,
        (entry) => entry.tickets.checkoutEvidenceUrl?.value,
      ),
      admissionPrice: firstValue(
        ticketEvidence,
        (entry) => entry.tickets.admissionPrice?.value,
      ),
      ticketPhases: firstValue(
        ticketEvidence,
        (entry) => entry.tickets.ticketPhases?.value,
      ),
      ticketStatus: firstValue(
        ticketEvidence,
        (entry) => entry.tickets.ticketStatus?.value,
      ),
    };
  }
}
