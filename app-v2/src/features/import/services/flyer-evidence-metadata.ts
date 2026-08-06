import { FLYER_EXTRACTION_ENGINE } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';

export const FLYER_LINEUP_EVIDENCE_KEY = 'flyerLineupEvidence';

export type FlyerEvidenceReviewState = 'pending' | 'accepted' | 'rejected';

export interface StoredFlyerLineupEvidence {
  imageUrl: string;
  rawText: string;
  contentHash: string;
  confidence: number;
  autoPublishAllowed: boolean;
  reviewState: FlyerEvidenceReviewState;
  extractedAt: string;
  engine: string;
  sourceConflict?: {
    textualSpelling?: string;
    flyerSpelling?: string;
    reason?: string;
  };
  dimensions?: { width: number; height: number };
}

export function readFlyerLineupEvidence(record: ImportRecord): StoredFlyerLineupEvidence | undefined {
  const metadata = (getEffectiveCandidate(record).sourceMetadata ?? {}) as Record<string, unknown>;
  const raw = metadata[FLYER_LINEUP_EVIDENCE_KEY];
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  return raw as StoredFlyerLineupEvidence;
}

export function isPublishableFlyerEvidence(
  evidence: StoredFlyerLineupEvidence | undefined,
): evidence is StoredFlyerLineupEvidence {
  if (!evidence?.rawText?.trim()) {
    return false;
  }
  if (evidence.reviewState === 'rejected') {
    return false;
  }
  if (evidence.reviewState === 'accepted') {
    return true;
  }
  return evidence.autoPublishAllowed === true && evidence.confidence >= 0.85;
}

export function attachFlyerLineupEvidenceToRecord(
  record: ImportRecord,
  evidence: Omit<StoredFlyerLineupEvidence, 'engine' | 'extractedAt'> & {
    engine?: string;
    extractedAt?: string;
  },
): ImportRecord {
  const normalizedPayload = { ...(record.normalizedPayload ?? {}) } as Record<string, unknown>;
  const sourceMetadata = {
    ...((normalizedPayload.sourceMetadata as Record<string, unknown> | undefined) ?? {}),
    [FLYER_LINEUP_EVIDENCE_KEY]: {
      ...evidence,
      engine: evidence.engine ?? FLYER_EXTRACTION_ENGINE,
      extractedAt: evidence.extractedAt ?? new Date().toISOString(),
    } satisfies StoredFlyerLineupEvidence,
  };

  return {
    ...record,
    normalizedPayload: {
      ...normalizedPayload,
      sourceMetadata,
    },
  };
}
