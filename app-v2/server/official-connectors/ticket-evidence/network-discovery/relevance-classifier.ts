import type { ElectronicRelevance } from './types';
import { classifyRelevanceEvidence, type RelevanceEvidenceInput } from './relevance-evidence';

export type RelevanceInput = RelevanceEvidenceInput;

export function classifyElectronicRelevance(input: RelevanceInput): {
  relevance: ElectronicRelevance;
  reasons: string[];
} {
  const result = classifyRelevanceEvidence(input);
  return {
    relevance: result.relevance,
    reasons: result.reasons,
  };
}
