import type { CanonicalLineupEntry, LineupEntryProvenance } from '@/features/aggregation/domain/canonical-lineup-entry';
import { parseFlyerTextToCanonicalEntries } from '@/features/aggregation/domain/flyer-lineup-to-canonical';
import {
  enrichFlyerLineup,
  hashFlyerImageContent,
  type FlyerLineupExtractionRecord,
} from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';

export interface FlyerLineupEvidenceBundle {
  extraction: FlyerLineupExtractionRecord;
  entries: CanonicalLineupEntry[];
  provenance: LineupEntryProvenance;
}

export function buildFlyerLineupEvidence(input: {
  eventId: string;
  originId?: string;
  imageUrl: string;
  rawText: string;
  previousHash?: string;
  eventTitle?: string;
  venueName?: string;
  cityName?: string;
  knownCanonicalNames?: string[];
}): FlyerLineupEvidenceBundle {
  const extraction = enrichFlyerLineup({
    imageUrl: input.imageUrl,
    rawText: input.rawText,
    previousHash: input.previousHash,
    eventTitle: input.eventTitle,
    venueName: input.venueName,
    cityName: input.cityName,
    knownCanonicalNames: input.knownCanonicalNames,
  });

  const provenance: LineupEntryProvenance = {
    source: 'structured',
    sourceUrl: input.imageUrl,
    connector: 'official_flyer',
    extractedAt: extraction.extractedAt,
  };

  const flyerEntries = parseFlyerTextToCanonicalEntries(input.rawText, {
    provenance,
    confidence: 0.92,
  });

  return {
    extraction: {
      ...extraction,
      contentHash: hashFlyerImageContent({ imageUrl: input.imageUrl, rawText: input.rawText }),
    },
    entries: flyerEntries,
    provenance,
  };
}
