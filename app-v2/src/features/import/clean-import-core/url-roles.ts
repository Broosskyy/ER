import type { ConnectorOutput } from './event-evidence';

export interface CleanUrlRoles {
  sourceUrl: string;
  officialWebsiteUrl?: string;
  publicTicketUrl?: string;
  checkoutEvidenceUrl?: string;
  outboundTicketUrls: string[];
}

function normalizedUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.map(normalizedUrl).filter((url): url is string => Boolean(url)))];
}

/** Keeps official, public-ticket, and checkout URL roles separate. */
export function collectCleanUrlRoles(output: ConnectorOutput): CleanUrlRoles {
  const sourceUrl = normalizedUrl(output.sourceUrl) ?? output.sourceUrl.trim();
  const isOfficial = output.sourceFamily === 'official_website';

  return {
    sourceUrl,
    officialWebsiteUrl: isOfficial
      ? normalizedUrl(output.officialWebsiteUrl) ?? sourceUrl
      : undefined,
    publicTicketUrl: isOfficial ? undefined : normalizedUrl(output.publicTicketUrl),
    checkoutEvidenceUrl: isOfficial
      ? undefined
      : normalizedUrl(output.checkoutEvidenceUrl),
    outboundTicketUrls: isOfficial
      ? uniqueUrls(output.outboundTicketUrls ?? [])
      : [],
  };
}
