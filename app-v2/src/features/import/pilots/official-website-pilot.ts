import type { UnifiedImportResult } from '@/features/import/contracts';
import {
  buildImportContextFromRef,
  runUnifiedWebsiteImport,
} from '@/features/import/unified-website';
import type { GoldStandardReferenceEvent } from './gold-standard-reference';
import { pilotFetchHtml } from './gold-standard-reference';

/**
 * Official website pilot for any gold-standard websiteUrl (bootshaus.tv, affenkaefig.info, etc.)
 * Delegates to the Phase 4.8.4 unified website importer (staging-only).
 */
export async function runOfficialWebsitePilotForEvent(
  ref: GoldStandardReferenceEvent,
): Promise<UnifiedImportResult> {
  const fetch = await pilotFetchHtml(ref.websiteUrl);
  return runUnifiedWebsiteImport({
    context: buildImportContextFromRef(ref),
    html: fetch.html,
    fetchMeta: {
      status: fetch.status,
      finalUrl: fetch.finalUrl,
      error: fetch.error,
    },
  });
}
