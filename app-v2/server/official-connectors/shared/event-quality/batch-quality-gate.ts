import type { EventQualityEvaluation } from './types';
import type { BatchQualitySummary } from './types';

export function summarizeBatchQuality(evaluations: EventQualityEvaluation[]): BatchQualitySummary {
  const summary: BatchQualitySummary = {
    candidatesSeen: evaluations.length,
    domainElectronicHigh: 0,
    domainElectronicMedium: 0,
    domainAmbiguous: 0,
    domainNonElectronic: 0,
    canonicalCreated: evaluations.length,
    canonicalMatched: 0,
    duplicateCandidates: 0,
    publishedEligible: 0,
    genreClassified: 0,
    genreUnresolved: 0,
    genreCoverage: 0,
    lineupComplete: 0,
    lineupPartial: 0,
    lineupNotAnnounced: 0,
    ticketVerified: 0,
    ticketUnsafe: 0,
    ticketUnavailable: 0,
    mediaQualified: 0,
    mediaMissing: 0,
    descriptionQualified: 0,
    descriptionMissing: 0,
    reviewRequired: 0,
    rejected: 0,
  };

  for (const evaluation of evaluations) {
    switch (evaluation.domain.classification) {
      case 'ELECTRONIC_HIGH':
        summary.domainElectronicHigh += 1;
        break;
      case 'ELECTRONIC_MEDIUM':
        summary.domainElectronicMedium += 1;
        break;
      case 'NON_ELECTRONIC':
        summary.domainNonElectronic += 1;
        break;
      default:
        summary.domainAmbiguous += 1;
    }

    if (evaluation.genre.coverageEligible) {
      summary.publishedEligible += 1;
      if (evaluation.genre.genres.length > 0) {
        summary.genreClassified += 1;
      } else {
        summary.genreUnresolved += 1;
      }
    }

    if (evaluation.lineup.state === 'VERIFIED') {
      summary.lineupComplete += 1;
    } else if (evaluation.lineup.state === 'PARTIAL') {
      summary.lineupPartial += 1;
    } else if (evaluation.lineup.state === 'MISSING') {
      summary.lineupNotAnnounced += 1;
    }

    if (evaluation.ticket.state === 'VERIFIED') {
      summary.ticketVerified += 1;
    } else if (evaluation.ticket.state === 'INVALID') {
      summary.ticketUnsafe += 1;
    } else if (evaluation.ticket.state === 'MISSING') {
      summary.ticketUnavailable += 1;
    }

    if (evaluation.media.state === 'VERIFIED') {
      summary.mediaQualified += 1;
    } else {
      summary.mediaMissing += 1;
    }

    if (evaluation.description.state === 'VERIFIED') {
      summary.descriptionQualified += 1;
    } else {
      summary.descriptionMissing += 1;
    }

    if (evaluation.qualityState === 'REVIEW_REQUIRED') {
      summary.reviewRequired += 1;
    }
    if (evaluation.qualityState === 'REJECTED' || evaluation.qualityState === 'QUARANTINED') {
      summary.rejected += 1;
    }
  }

  summary.genreCoverage =
    summary.publishedEligible > 0 ? summary.genreClassified / summary.publishedEligible : 0;
  return summary;
}
