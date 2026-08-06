/**
 * Phase 4.7.5 — Structured flyer evidence with confidence classification.
 */

import { parseFlyerLineupCandidates } from '@/features/aggregation/domain/flyer-lineup-parser';
import type { FlyerOcrResult } from './flyer-ocr-provider';

export type FlyerEvidenceReviewDecision = 'auto_publish' | 'review_required' | 'rejected';

export interface StructuredFlyerHint {
  kind:
    | 'artist'
    | 'timetable'
    | 'floor'
    | 'ticket'
    | 'venue'
    | 'promoter'
    | 'billing_relation';
  value: string;
  confidence: number;
  sourceLine?: string;
}

export interface StructuredFlyerEvidence {
  eventId: string;
  imageUrl: string;
  ocr: FlyerOcrResult;
  hints: StructuredFlyerHint[];
  artistCount: number;
  billingRelations: string[];
  overallConfidence: number;
  reviewDecision: FlyerEvidenceReviewDecision;
  rejectionReason?: string;
  autoPublishAllowed: boolean;
}

const TIMETABLE_PATTERN =
  /\b(?:\d{1,2}[:.]\d{2}\s*(?:-|–|bis|to)\s*\d{1,2}[:.]\d{2}|\d{1,2}[:.]\d{2}\s*(?:uhr|h))\b/i;
const FLOOR_PATTERN = /\b(?:floor|fl\.?|etage|deck|stage|bühne|room)\s*[\dA-Z]+/i;
const TICKET_PATTERN = /\b(?:ab\s+)?\d{1,3}[.,]\d{2}\s*€|tickets?|vorverkauf|presale|sold\s*out|ausverkauft/i;
const PROMOTER_PATTERN = /\b(?:presented\s+by|presents?|hosted\s+by|in\s+cooperation\s+with)\b/i;

const AUTO_PUBLISH_MIN_CONFIDENCE = 0.85;

function detectHintsFromText(
  rawText: string,
  context: { eventTitle?: string; venueName?: string; organizerName?: string },
): StructuredFlyerHint[] {
  const hints: StructuredFlyerHint[] = [];
  const lines = rawText.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    if (TIMETABLE_PATTERN.test(line)) {
      hints.push({ kind: 'timetable', value: line, confidence: 0.8, sourceLine: line });
    }
    if (FLOOR_PATTERN.test(line)) {
      hints.push({ kind: 'floor', value: line, confidence: 0.75, sourceLine: line });
    }
    if (TICKET_PATTERN.test(line)) {
      hints.push({ kind: 'ticket', value: line, confidence: 0.7, sourceLine: line });
    }
    if (PROMOTER_PATTERN.test(line)) {
      hints.push({ kind: 'promoter', value: line, confidence: 0.72, sourceLine: line });
    }
  }

  if (context.venueName && rawText.toLowerCase().includes(context.venueName.toLowerCase())) {
    hints.push({ kind: 'venue', value: context.venueName, confidence: 0.85 });
  }
  if (context.organizerName && rawText.toLowerCase().includes(context.organizerName.toLowerCase())) {
    hints.push({ kind: 'promoter', value: context.organizerName, confidence: 0.8 });
  }

  const candidates = parseFlyerLineupCandidates({
    rawText,
    eventTitle: context.eventTitle,
    venueName: context.venueName,
  });

  for (const candidate of candidates) {
    if (candidate.rejected) {
      continue;
    }
    hints.push({
      kind: 'artist',
      value: candidate.displayName,
      confidence: candidate.confidence,
    });
    if (candidate.isB2b) {
      hints.push({
        kind: 'billing_relation',
        value: 'B2B',
        confidence: candidate.confidence,
      });
    }
    if (candidate.isF2f) {
      hints.push({
        kind: 'billing_relation',
        value: 'F2F',
        confidence: candidate.confidence,
      });
    }
  }

  return hints;
}

export function classifyStructuredFlyerEvidence(input: {
  eventId: string;
  imageUrl: string;
  ocr: FlyerOcrResult;
  eventTitle?: string;
  venueName?: string;
  organizerName?: string;
}): StructuredFlyerEvidence {
  const rawText = input.ocr.rawText?.trim();
  if (!rawText) {
    return {
      eventId: input.eventId,
      imageUrl: input.imageUrl,
      ocr: input.ocr,
      hints: [],
      artistCount: 0,
      billingRelations: [],
      overallConfidence: input.ocr.confidence,
      reviewDecision: 'review_required',
      rejectionReason:
        input.ocr.status === 'pending_external'
          ? 'awaiting_ocr_provider'
          : 'no_extractable_text',
      autoPublishAllowed: false,
    };
  }

  const hints = detectHintsFromText(rawText, {
    eventTitle: input.eventTitle,
    venueName: input.venueName,
    organizerName: input.organizerName,
  });
  const artistHints = hints.filter((hint) => hint.kind === 'artist');
  const billingRelations = [
    ...new Set(hints.filter((hint) => hint.kind === 'billing_relation').map((hint) => hint.value)),
  ];

  const artistConfidence =
    artistHints.length > 0
      ? artistHints.reduce((sum, hint) => sum + hint.confidence, 0) / artistHints.length
      : 0;
  const overallConfidence = Math.min(1, (input.ocr.confidence + artistConfidence) / 2);

  let reviewDecision: FlyerEvidenceReviewDecision = 'review_required';
  let rejectionReason: string | undefined;
  let autoPublishAllowed = false;

  if (artistHints.length === 0) {
    rejectionReason = 'no_artist_hints_detected';
  } else if (overallConfidence >= AUTO_PUBLISH_MIN_CONFIDENCE && input.ocr.source !== 'none') {
    reviewDecision = 'auto_publish';
    autoPublishAllowed = true;
  } else {
    rejectionReason = 'confidence_below_auto_publish_threshold';
  }

  return {
    eventId: input.eventId,
    imageUrl: input.imageUrl,
    ocr: input.ocr,
    hints,
    artistCount: artistHints.length,
    billingRelations,
    overallConfidence,
    reviewDecision,
    rejectionReason,
    autoPublishAllowed,
  };
}
