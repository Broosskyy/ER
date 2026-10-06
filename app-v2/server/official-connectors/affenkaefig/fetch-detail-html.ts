import { SafeFetchError, safeFetchHtmlWithPolicy, type SafeFetchRequestContext, type SafeFetchRequestOptions, type SafeFetchResult } from '../generic-safe-fetch';
import type { ConnectorErrorCounters } from '../types';
import { affenkaefigSafeFetchPolicy } from './fetch-policy';
import {
  buildAffenkaefigShortlinkUrl,
  resolveAffenkaefigPostIdForDetailUrl,
} from './resolve-wp-post-id';
import { extractAffenkaefigDetailSlug, isAffenkaefigDetailUrl } from './url-policy';

function isUsableAffenkaefigDetailHtml(html: string, detailUrl: string): boolean {
  if (!html.includes('ecm-event-single__title')) {
    return false;
  }
  const slug = extractAffenkaefigDetailSlug(detailUrl);
  if (!slug) {
    return true;
  }
  return html.includes(slug) || html.includes('ecm-event-single__ticket-snippet');
}

export async function fetchAffenkaefigDetailHtml(
  detailUrl: string,
  options: SafeFetchRequestOptions & { counters: ConnectorErrorCounters },
  context: SafeFetchRequestContext = { allowDetailOnly: true },
): Promise<SafeFetchResult> {
  try {
    const direct = await safeFetchHtmlWithPolicy(detailUrl, affenkaefigSafeFetchPolicy, options, context);
    if (
      isAffenkaefigDetailUrl(direct.finalUrl) &&
      isUsableAffenkaefigDetailHtml(direct.html, detailUrl)
    ) {
      return direct;
    }
  } catch (error) {
    if (!(error instanceof SafeFetchError)) {
      throw error;
    }
  }

  const postId = await resolveAffenkaefigPostIdForDetailUrl(detailUrl);
  if (!postId) {
    const slug = extractAffenkaefigDetailSlug(detailUrl);
    throw new SafeFetchError(
      `Affenkäfig detail page could not be resolved from WordPress index (slug=${slug ?? 'missing'}).`,
      'http_error',
    );
  }

  const shortlink = buildAffenkaefigShortlinkUrl(postId);
  const fallback = await safeFetchHtmlWithPolicy(
    shortlink,
    affenkaefigSafeFetchPolicy,
    options,
    { ...context, allowShortlinkFallback: true },
  );

  if (!isUsableAffenkaefigDetailHtml(fallback.html, detailUrl)) {
    throw new SafeFetchError('Affenkäfig detail fallback HTML was unusable.', 'http_error');
  }

  return fallback;
}
