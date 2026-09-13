import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { EventSeriesIdentityMatch } from './types';

export function matchEventSeriesIdentity(event: StagingEventSnapshot): EventSeriesIdentityMatch | undefined {
  const title = event.title.toLowerCase();
  const sourceUrls = event.sources.map((source) => source.sourceUrl ?? '').join(' ').toLowerCase();

  if (/\bmdma\b/.test(title) && /musik die mich antreibt/i.test(title)) {
    const affenkaefigBinding = /affenkaefig\.info\/event\/mdma/i.test(sourceUrls);
    return {
      seriesId: 'series:affenkaefig-mdma',
      canonicalName: 'MDMA – Musik Die Mich Antreibt',
      confidence: affenkaefigBinding ? 'HIGH' : 'MEDIUM',
      reasons: affenkaefigBinding
        ? ['canonical_series_title', 'official_affenkaefig_event_url']
        : ['canonical_series_title'],
    };
  }

  if (/\bbootshaus on a ship\b/i.test(title)) {
    const bootshausBinding = /bootshaus\.tv\/events\/bootshaus-on-a-ship/i.test(sourceUrls);
    return {
      seriesId: 'series:bootshaus-ship',
      canonicalName: 'Bootshaus on a Ship',
      confidence: bootshausBinding ? 'HIGH' : 'MEDIUM',
      reasons: bootshausBinding
        ? ['canonical_series_title', 'official_bootshaus_event_url']
        : ['canonical_series_title'],
    };
  }

  if (/\bmdma\b/i.test(title) && /\bbootshaus\b/i.test(title)) {
    return {
      seriesId: 'series:bootshaus-mdma',
      canonicalName: 'MDMA @ Bootshaus',
      confidence: 'HIGH',
      reasons: ['canonical_series_title', 'bootshaus_promoter_binding'],
    };
  }

  return undefined;
}
