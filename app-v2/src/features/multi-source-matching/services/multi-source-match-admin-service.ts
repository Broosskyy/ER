import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type {
  EventMatchEvaluationRepository,
  EventMergeCandidateRepository,
} from '../domain/matching-types';

export interface SourceMatchingStatus {
  sourceId: string;
  recentEvaluations: number;
  pendingMergeCandidates: number;
  autoLinkedCount: number;
  reviewRequiredCount: number;
}

export class MultiSourceMatchAdminService {
  constructor(
    private readonly sourceRepository: AdminSourceRepository,
    private readonly evaluationRepository: EventMatchEvaluationRepository,
    private readonly mergeCandidateRepository: EventMergeCandidateRepository,
  ) {}

  async getSourceStatus(sourceId: string): Promise<SourceMatchingStatus | null> {
    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      return null;
    }

    const evaluations = await this.evaluationRepository.listBySourceId(sourceId, 100);
    const pendingCandidates = (await this.mergeCandidateRepository.listPending(200)).filter(
      (candidate) => candidate.sourceId === sourceId,
    );

    return {
      sourceId,
      recentEvaluations: evaluations.length,
      pendingMergeCandidates: pendingCandidates.length,
      autoLinkedCount: evaluations.filter((entry) => entry.decision === 'auto_link').length,
      reviewRequiredCount: evaluations.filter((entry) => entry.decision === 'review_required').length,
    };
  }

  async listRecentEvaluations(limit = 100) {
    return this.evaluationRepository.listRecent(limit);
  }

  async listPendingMergeCandidates(limit = 100) {
    return this.mergeCandidateRepository.listPending(limit);
  }

  async listEvaluationsForEvent(canonicalEventId: string, limit = 50) {
    return this.evaluationRepository.listByCanonicalEventId(canonicalEventId, limit);
  }
}
