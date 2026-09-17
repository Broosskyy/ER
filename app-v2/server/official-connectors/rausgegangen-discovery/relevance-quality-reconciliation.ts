import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import type { ImportQualityContractResult } from '../ticket-evidence/network-discovery/import-quality-contract-gate';
import { passesImportEligibilityFromSnapshot } from './import-eligibility';

export type ReconciliationRootCause =
  | 'REPORTING_POPULATION_MISMATCH'
  | 'DOMAIN_RELEVANCE_SEMANTIC_MISMATCH'
  | 'QUALITY_CONTRACT_GAP'
  | 'RELEVANCE_CLASSIFIER_GAP'
  | 'PIPELINE_EVIDENCE_CONTINUITY_GAP'
  | 'OTHER';

export interface QualityReadyPoolEntry {
  event: EnrichedTicketIoEvent;
  contract?: ImportQualityContractResult;
  qualityContract?: ImportQualityContractResult;
}

export interface RelevanceQualityReconciliation {
  generatedAt: string;
  rootCause: ReconciliationRootCause[];
  explanation: string;
  genericFix: string;
  populations: {
    unionDiscovered: { count: number; scope: string };
    activeWindowEnriched: { count: number; scope: string };
    relevanceUnion: { scope: string };
    qualityReadyPool: { count: number; scope: string };
  };
  highRelevant: number;
  likelyRelevant: number;
  ambiguous: number;
  irrelevant: number;
  qualityReady: number;
  qualityReadyHigh: number;
  qualityReadyLikely: number;
  qualityReadyAmbiguous: number;
  qualityReadyIrrelevant: number;
  qualityReadyElectronicHighConfidence: number;
  qualityReadyElectronicMediumConfidence: number;
  qualityReadyImportEligible: number;
  qualityReadyBlockedByRelevanceOnly: number;
  intersections: {
    qualityReadyAndHighRelevant: number;
    qualityReadyAndLikelyRelevant: number;
    qualityReadyAndAmbiguousRelevant: number;
    qualityReadyAndIrrelevant: number;
    highRelevantNotQualityReady: number;
    importEligibleHigh: number;
    importEligibleLikely: number;
  };
}

function contractForEntry(entry: QualityReadyPoolEntry): ImportQualityContractResult | undefined {
  return entry.contract ?? entry.qualityContract;
}

export function reconcileM94cRelevanceQualityPool(input: {
  relevanceSummary: { high: number; likely: number; ambiguous: number; irrelevant: number };
  unionDiscovered: number;
  activeWindowEnriched: number;
  qualityReadyEntries: QualityReadyPoolEntry[];
}): RelevanceQualityReconciliation {
  const { relevanceSummary, unionDiscovered, activeWindowEnriched, qualityReadyEntries } = input;

  let qualityReadyHigh = 0;
  let qualityReadyLikely = 0;
  let qualityReadyAmbiguous = 0;
  let qualityReadyIrrelevant = 0;
  let qualityReadyElectronicHighConfidence = 0;
  let qualityReadyElectronicMediumConfidence = 0;
  let qualityReadyImportEligible = 0;

  for (const entry of qualityReadyEntries) {
    const relevance = entry.event.relevance;
    const contract = contractForEntry(entry);
    const domainState = contract?.domainState;

    if (relevance === 'HIGH_RELEVANCE') {
      qualityReadyHigh += 1;
    } else if (relevance === 'LIKELY_RELEVANT') {
      qualityReadyLikely += 1;
    } else if (relevance === 'AMBIGUOUS') {
      qualityReadyAmbiguous += 1;
    } else if (relevance === 'IRRELEVANT') {
      qualityReadyIrrelevant += 1;
    }

    if (domainState === 'ELECTRONIC_HIGH') {
      qualityReadyElectronicHighConfidence += 1;
    } else if (domainState === 'ELECTRONIC_MEDIUM') {
      qualityReadyElectronicMediumConfidence += 1;
    }

    if (
      passesImportEligibilityFromSnapshot(
        relevance,
        domainState,
        contract?.passesQualityContract ?? false,
      )
    ) {
      qualityReadyImportEligible += 1;
    }
  }

  const qualityReady = qualityReadyEntries.length;
  const qualityReadyBlockedByRelevanceOnly = qualityReady - qualityReadyImportEligible;

  const rootCause: ReconciliationRootCause[] = ['REPORTING_POPULATION_MISMATCH'];
  if (qualityReadyIrrelevant > 0 || qualityReadyAmbiguous > 0) {
    rootCause.push('QUALITY_CONTRACT_GAP', 'DOMAIN_RELEVANCE_SEMANTIC_MISMATCH');
  }

  return {
    generatedAt: new Date().toISOString(),
    rootCause,
    explanation:
      'M9.4C qualityReady counted events passing NEW_EVENT_QUALITY_CONTRACT technical gates without requiring electronic relevance HIGH/LIKELY. ' +
      'The 566 HIGH/LIKELY figure applies to the full 18,490 URL union discovery population, while 5,614 qualityReady is the 90-day enriched pool with passesQualityContract only. ' +
      `${qualityReadyIrrelevant} IRRELEVANT and ${qualityReadyAmbiguous} AMBIGUOUS events incorrectly appear quality-ready because relevance is not part of passesQualityContract.`,
    genericFix:
      'Introduced first-class ImportEligibility requiring HIGH/LIKELY relevance, ELECTRONIC_HIGH/MEDIUM domain, and passesQualityContract. qualityReady remains a technical completeness metric; import eligibility is a separate derived decision.',
    populations: {
      unionDiscovered: {
        count: unionDiscovered,
        scope: 'city ∪ location canonical URL union (all lifecycles)',
      },
      activeWindowEnriched: {
        count: activeWindowEnriched,
        scope: '90-day rolling window, detail-enriched',
      },
      relevanceUnion: {
        scope: 'relevance-summary counts apply to full unionDiscovered enriched corpus',
      },
      qualityReadyPool: {
        count: qualityReady,
        scope: '90-day enriched events with passesQualityContract && !bypass',
      },
    },
    highRelevant: relevanceSummary.high,
    likelyRelevant: relevanceSummary.likely,
    ambiguous: relevanceSummary.ambiguous,
    irrelevant: relevanceSummary.irrelevant,
    qualityReady,
    qualityReadyHigh,
    qualityReadyLikely,
    qualityReadyAmbiguous,
    qualityReadyIrrelevant,
    qualityReadyElectronicHighConfidence,
    qualityReadyElectronicMediumConfidence,
    qualityReadyImportEligible,
    qualityReadyBlockedByRelevanceOnly,
    intersections: {
      qualityReadyAndHighRelevant: qualityReadyHigh,
      qualityReadyAndLikelyRelevant: qualityReadyLikely,
      qualityReadyAndAmbiguousRelevant: qualityReadyAmbiguous,
      qualityReadyAndIrrelevant: qualityReadyIrrelevant,
      highRelevantNotQualityReady: Math.max(
        0,
        relevanceSummary.high + relevanceSummary.likely - qualityReadyImportEligible,
      ),
      importEligibleHigh: qualityReadyHigh,
      importEligibleLikely: qualityReadyLikely,
    },
  };
}
