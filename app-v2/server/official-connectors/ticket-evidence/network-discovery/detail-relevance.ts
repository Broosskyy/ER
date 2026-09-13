import type { DetailAccessStatus } from './detail-types';
import {
  classifyRelevanceEvidence,
  type RelevanceEvidenceInput,
  type RelevanceEvidenceResult,
} from './relevance-evidence';

export interface DetailRelevanceInput extends RelevanceEvidenceInput {
  detailAccess?: DetailAccessStatus;
}

export type DetailRelevanceResult = RelevanceEvidenceResult;

export function classifyDetailRelevance(input: DetailRelevanceInput): DetailRelevanceResult {
  return classifyRelevanceEvidence(input);
}
