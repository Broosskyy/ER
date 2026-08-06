/** Structured lineup provenance and completeness — shared import contract. */

export type LineupCompletenessState =
  | 'complete'
  | 'partial'
  | 'title_inferred_only'
  | 'flyer_extracted_review_required'
  | 'blocked_detail_fetch'
  | 'unavailable';

export type LineupEntrySource =
  | 'json_ld'
  | 'html_lineup'
  | 'title'
  | 'structured'
  | 'source_lineup';

export interface StructuredLineupEntry {
  displayName: string;
  normalizedName: string;
  role?: string;
  headliner?: boolean;
  isB2b?: boolean;
  isF2f?: boolean;
  isLiveSet?: boolean;
  stageOrFloor?: string;
  startTime?: string;
  endTime?: string;
  source: LineupEntrySource;
  confidence: number;
  sortOrder: number;
}

export function resolveLineupCompletenessState(input: {
  entries: StructuredLineupEntry[];
  detailBlocked?: boolean;
  titleInferredOnly?: boolean;
}): LineupCompletenessState {
  if (input.detailBlocked && input.entries.length === 0) {
    return 'blocked_detail_fetch';
  }
  if (input.entries.length === 0) {
    return 'unavailable';
  }
  if (input.titleInferredOnly) {
    return 'title_inferred_only';
  }
  const structuredCount = input.entries.filter((entry) => entry.source !== 'title').length;
  if (structuredCount === 0) {
    return 'title_inferred_only';
  }
  if (structuredCount >= 1 && input.entries.length === structuredCount) {
    return 'complete';
  }
  return structuredCount >= 1 ? 'partial' : 'title_inferred_only';
}
