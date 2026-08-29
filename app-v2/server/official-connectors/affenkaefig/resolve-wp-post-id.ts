import { AFFENKAEFIG_HOST, AFFENKAEFIG_USER_AGENT } from './constants';
import { extractAffenkaefigDetailSlug } from './url-policy';

const WP_EVENT_INDEX_URL = `https://${AFFENKAEFIG_HOST}/wp-json/wp/v2/ecm_event?per_page=100&_fields=id,slug`;

interface WpEventIndexRow {
  id: number;
  slug: string;
}

let cachedSlugToPostId: Map<string, number> | undefined;

function normalizeAffenkaefigSlugKey(slug: string): string {
  return slug.trim().toLowerCase().replace(/ae/g, 'a');
}

function findPostIdForSlug(index: Map<string, number>, slug: string): number | undefined {
  const direct = index.get(slug.toLowerCase());
  if (direct != null) {
    return direct;
  }
  const normalizedTarget = normalizeAffenkaefigSlugKey(slug);
  for (const [candidateSlug, postId] of index.entries()) {
    if (normalizeAffenkaefigSlugKey(candidateSlug) === normalizedTarget) {
      return postId;
    }
  }
  return undefined;
}

async function loadSlugToPostIdIndex(): Promise<Map<string, number>> {
  if (cachedSlugToPostId) {
    return cachedSlugToPostId;
  }

  const response = await fetch(WP_EVENT_INDEX_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': AFFENKAEFIG_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`affenkaefig_wp_index_http_${response.status}`);
  }

  const rows = (await response.json()) as WpEventIndexRow[];
  cachedSlugToPostId = new Map(
    rows
      .filter((row) => row.id != null && typeof row.slug === 'string')
      .map((row) => [row.slug.toLowerCase(), Number(row.id)]),
  );
  return cachedSlugToPostId;
}

export function resetAffenkaefigWpPostIdCacheForTests(): void {
  cachedSlugToPostId = undefined;
}

export async function resolveAffenkaefigPostIdForDetailUrl(detailUrl: string): Promise<number | undefined> {
  const slug = extractAffenkaefigDetailSlug(detailUrl);
  if (!slug) {
    return undefined;
  }
  const index = await loadSlugToPostIdIndex();
  const resolved = findPostIdForSlug(index, slug);
  if (resolved == null && index.size === 0) {
    throw new Error('affenkaefig_wp_index_empty');
  }
  return resolved;
}

export function buildAffenkaefigShortlinkUrl(postId: number): string {
  return `https://${AFFENKAEFIG_HOST}/?p=${postId}`;
}
