import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { deriveTicketStatusFromPhases } from '@/features/import/domain/canonical-ticket-phase';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

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

function isRedirectPlaceholderContent(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(?:301|302|303|307|308)\s+(?:moved permanently|found|temporary redirect|permanent redirect)$/i.test(
    text,
  );
}

function sanitizeLineup(output: ConnectorOutput): ConnectorOutput['lineup'] {
  if (output.lineupState === 'tba' || !output.lineup?.length) {
    return undefined;
  }
  const acceptedNames = new Set(
    (sanitizeLineupArtistNames(output.lineup.map((entry) => entry.displayName)) ?? []).map(
      normalizeMatchText,
    ),
  );
  const seen = new Set<string>();
  return output.lineup.filter((entry) => {
    if (
      isRedirectPlaceholderContent(entry.displayName) ||
      /[<>]/.test(entry.displayName) ||
      /^(?:line[\s-]?up|artists?|genres?|transport|tickets?)\b/i.test(
        entry.displayName.trim(),
      )
    ) {
      return false;
    }
    const key = normalizeMatchText(entry.displayName);
    if (!acceptedNames.has(key) || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** Converts normalized connector output into provenance-preserving event evidence. */
export class SourceAdapter {
  adapt(output: ConnectorOutput): EventEvidence {
    const urls = collectCleanUrlRoles(output);
    const verifiedAt = output.verifiedAt?.trim() || undefined;
    const isOfficial = output.sourceFamily === 'official_website';
    const lineup = sanitizeLineup(output);
    const admissionProducts = isOfficial
      ? undefined
      : (output.admissionProducts ?? output.ticketPhases)?.filter(
          (phase) => phase.priceAmount !== 0 || phase.isFree === true,
        );
    const ticketPhases = isOfficial
      ? undefined
      : output.ticketPhases?.filter(
          (phase) => phase.priceAmount !== 0 || phase.isFree === true,
        );
    const zeroPriceIsExplicitlyFree =
      output.admissionPrice?.amount === 0 &&
      admissionProducts?.some((phase) => phase.isFree === true);
    const admissionPrice =
      output.admissionPrice &&
      (output.admissionPrice.amount > 0 || zeroPriceIsExplicitlyFree)
        ? output.admissionPrice
        : undefined;
    const ticketStatus = isOfficial
      ? undefined
      : deriveTicketStatusFromPhases(admissionProducts ?? ticketPhases, output.ticketStatus);
    const filteredLineupCount = (output.lineup?.length ?? 0) - (lineup?.length ?? 0);
    const redirectPlaceholderRejected = [
      output.title,
      output.description,
      ...(output.lineup?.map((entry) => entry.displayName) ?? []),
    ].some(isRedirectPlaceholderContent);

    return {
      sourceId: output.sourceId,
      sourceFamily: output.sourceFamily,
      sourceUrl: urls.sourceUrl,
      requestedSourceUrl: output.requestedSourceUrl,
      finalSourceUrl: output.finalSourceUrl ?? urls.sourceUrl,
      verifiedAt,
      identity: {
        title: evidenceValue(
          isRedirectPlaceholderContent(output.title) ? undefined : output.title,
          urls.sourceUrl,
          verifiedAt,
        ),
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
        description: evidenceValue(
          isRedirectPlaceholderContent(output.description)
            ? undefined
            : output.description,
          urls.sourceUrl,
          verifiedAt,
        ),
        genres: evidenceValue(output.genres, urls.sourceUrl, verifiedAt),
        lineup: evidenceValue(lineup, urls.sourceUrl, verifiedAt),
        lineupState: evidenceValue(
          output.lineupState === 'tba'
            ? 'tba'
            : lineup?.length
              ? 'explicit_artists'
              : undefined,
          urls.sourceUrl,
          verifiedAt,
        ),
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
          : evidenceValue(admissionPrice, urls.sourceUrl, verifiedAt),
        ticketPhases: isOfficial
          ? undefined
          : evidenceValue(ticketPhases, urls.sourceUrl, verifiedAt),
        admissionProducts: isOfficial
          ? undefined
          : evidenceValue(admissionProducts, urls.sourceUrl, verifiedAt),
        excludedProducts: isOfficial
          ? undefined
          : evidenceValue(output.excludedProducts, urls.sourceUrl, verifiedAt),
        ticketStatus: isOfficial
          ? undefined
          : evidenceValue(ticketStatus, urls.sourceUrl, verifiedAt),
      },
      duplicateCandidate: output.duplicateCandidate === true,
      diagnostics: [
        ...(output.diagnostics ?? []),
        ...(!verifiedAt ? ['verified_at:missing'] : []),
        ...(output.admissionPrice?.amount === 0 && !zeroPriceIsExplicitlyFree
          ? ['ticket_price_zero_unverified']
          : []),
        ...(filteredLineupCount > 0
          ? [`lineup_entries_filtered:${filteredLineupCount}`]
          : []),
        ...(redirectPlaceholderRejected
          ? ['redirect_placeholder_content_rejected']
          : []),
      ],
    };
  }
}
