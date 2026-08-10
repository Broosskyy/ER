import type { EvidencedValue, ConnectorOutput, EventEvidence } from './event-evidence';
import { collectCleanUrlRoles } from './url-roles';

function evidenceValue<T>(
  value: T | undefined,
  sourceUrl: string,
  verifiedAt: string | undefined,
): EvidencedValue<T> | undefined {
  if (value === undefined || !verifiedAt?.trim()) {
    return undefined;
  }
  if (typeof value === 'string' && !value.trim()) {
    return undefined;
  }
  if (Array.isArray(value) && value.length === 0) {
    return undefined;
  }
  return { value, sourceUrl, verifiedAt };
}

/** Converts normalized connector output into provenance-preserving event evidence. */
export class SourceAdapter {
  adapt(output: ConnectorOutput): EventEvidence {
    const urls = collectCleanUrlRoles(output);
    const verifiedAt = output.verifiedAt?.trim() || undefined;
    const isOfficial = output.sourceFamily === 'official_website';
    const lineup = output.lineupState === 'tba' ? undefined : output.lineup;

    return {
      sourceId: output.sourceId,
      sourceFamily: output.sourceFamily,
      sourceUrl: urls.sourceUrl,
      verifiedAt,
      identity: {
        title: evidenceValue(output.title, urls.sourceUrl, verifiedAt),
        startDate: evidenceValue(output.startDate, urls.sourceUrl, verifiedAt),
        endDate: evidenceValue(output.endDate, urls.sourceUrl, verifiedAt),
        venueName: evidenceValue(output.venueName, urls.sourceUrl, verifiedAt),
        locationText: evidenceValue(output.locationText, urls.sourceUrl, verifiedAt),
        officialWebsiteUrl: evidenceValue(
          urls.officialWebsiteUrl,
          urls.sourceUrl,
          verifiedAt,
        ),
        outboundTicketUrls: urls.outboundTicketUrls,
      },
      content: {
        description: evidenceValue(output.description, urls.sourceUrl, verifiedAt),
        genres: evidenceValue(output.genres, urls.sourceUrl, verifiedAt),
        lineup: evidenceValue(lineup, urls.sourceUrl, verifiedAt),
        lineupState: evidenceValue(output.lineupState, urls.sourceUrl, verifiedAt),
        lineupReason: evidenceValue(output.lineupReason, urls.sourceUrl, verifiedAt),
        minimumAge: evidenceValue(output.minimumAge, urls.sourceUrl, verifiedAt),
        venueEnvironment: evidenceValue(
          output.venueEnvironment,
          urls.sourceUrl,
          verifiedAt,
        ),
      },
      tickets: {
        publicTicketUrl: isOfficial
          ? undefined
          : evidenceValue(urls.publicTicketUrl, urls.sourceUrl, verifiedAt),
        checkoutEvidenceUrl: isOfficial
          ? undefined
          : evidenceValue(urls.checkoutEvidenceUrl, urls.sourceUrl, verifiedAt),
        admissionPrice: isOfficial
          ? undefined
          : evidenceValue(output.admissionPrice, urls.sourceUrl, verifiedAt),
        ticketPhases: isOfficial
          ? undefined
          : evidenceValue(output.ticketPhases, urls.sourceUrl, verifiedAt),
        ticketStatus: isOfficial
          ? undefined
          : evidenceValue(output.ticketStatus, urls.sourceUrl, verifiedAt),
      },
      duplicateCandidate: output.duplicateCandidate === true,
      diagnostics: [
        ...(output.diagnostics ?? []),
        ...(!verifiedAt ? ['verified_at:missing'] : []),
      ],
    };
  }
}
