import type { DuplicateDecision } from '@/features/aggregation/merge/event-conflict';
import type { DuplicateDecisionRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { ImportAuditLogRepository } from '@/data/repositories/import-admin-repository';

export class DuplicateDecisionService {
  constructor(
    private readonly repository: DuplicateDecisionRepository,
    private readonly auditRepository: ImportAuditLogRepository,
  ) {}

  async decide(decision: DuplicateDecision): Promise<DuplicateDecision> {
    const existing = await this.repository.findActiveKeptSeparateDecision(decision.candidateIds);
    if (existing && decision.decision === 'merged') {
      throw new Error('A kept-separate decision blocks automatic merging until it is reversed.');
    }
    const saved = await this.repository.createDecision(decision);
    await this.auditRepository.create({
      actorId: decision.decidedBy ?? 'system',
      action: 'duplicate_decision_saved',
      entityType: 'duplicate_decision',
      entityId: saved.id,
      summary: `${saved.decision}: ${saved.candidateIds.join(', ')}`,
    });
    return saved;
  }
}
