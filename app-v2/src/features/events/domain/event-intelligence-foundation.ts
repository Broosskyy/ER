/**
 * Event intelligence foundation (ER-005.5) — planning types only.
 *
 * Preserves architecture for future automation without implementing pipelines.
 * Do not add breaking migrations that would block these capabilities.
 */

export type EventImportSourceType =
  | 'manual'
  | 'website'
  | 'flyer'
  | 'pdf'
  | 'screenshot_ocr'
  | 'organizer_sync'
  | 'batch';

export type EventIntelligenceConfidenceBand = 'low' | 'medium' | 'high';

/** Planned metadata on import candidates / review queue items. */
export interface EventIntelligenceMetadataFoundation {
  sourceType: EventImportSourceType;
  sourceUrl?: string;
  importedAt?: string;
  lastCheckedAt?: string;
  confirmedBy?: string;
  confidenceScore?: number;
  confidenceBand?: EventIntelligenceConfidenceBand;
  duplicateOfEventId?: string;
  changeDetectedAt?: string;
}

/** Planned automation capabilities (not implemented). */
export type EventAutomationCapability =
  | 'ai_assisted_creation'
  | 'website_import'
  | 'flyer_import'
  | 'pdf_import'
  | 'screenshot_ocr'
  | 'batch_import'
  | 'organizer_sync'
  | 'nightly_sync'
  | 'duplicate_detection'
  | 'change_detection'
  | 'review_queue'
  | 'data_quality_scoring';
