import type { SourceEvidenceContribution } from './types';

function readMetaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function collectDetailUrlsFromContribution(contribution: SourceEvidenceContribution): string[] {
  const urls = new Set<string>();
  const candidate = contribution.candidate;
  const meta = (candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};

  if (candidate.eventUrl?.trim()) urls.add(candidate.eventUrl.trim());
  if (candidate.ticketUrl?.trim()) urls.add(candidate.ticketUrl.trim());
  if (candidate.sourceUrl?.trim()) urls.add(candidate.sourceUrl.trim());

  const checkout = readMetaString(meta, 'checkoutEvidenceUrl');
  const publicCta = readMetaString(meta, 'publicCtaCandidateUrl');
  const official = readMetaString(meta, 'officialEventUrl');

  if (checkout) urls.add(checkout);
  if (publicCta) urls.add(publicCta);
  if (official) urls.add(official);

  return [...urls];
}

export function contributionMatchesEventScope(
  contribution: SourceEvidenceContribution,
  eventIds: Set<string>,
): boolean {
  if (!eventIds.size) return true;
  if (contribution.mappedEventId && eventIds.has(contribution.mappedEventId)) {
    return true;
  }
  return false;
}
