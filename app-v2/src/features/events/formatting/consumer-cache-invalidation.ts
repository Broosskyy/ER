import { clearEventDetailCache } from '@/features/event-detail/feed/discovery-event-detail-client';
import { clearHomeFeedRequestCache } from '@/features/home/feed/discovery-feed-client';
import { clearDiscoverySearchRequestCache } from '@/features/search/feed/discovery-search-client';
import type { EventRepository } from '@/data/repositories/repositories';

/**
 * Single entry point for invalidating all consumer-facing event caches after
 * canonical event data changes (import, publish, merge, provenance, moderation).
 */
export async function invalidateConsumerEventCaches(
  consumerEventRepository?: EventRepository,
): Promise<void> {
  clearEventDetailCache();
  clearHomeFeedRequestCache();
  clearDiscoverySearchRequestCache();
  if (consumerEventRepository) {
    await consumerEventRepository.refresh();
  }
}
