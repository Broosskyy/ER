import type { SourceReference } from '@/features/aggregation/identity/event-identity';
import type { DuplicateDecision, EventConflict, FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import type {
  DuplicateDecisionRepository,
  EventConflictRepository,
  EventSourceReferenceRepository,
  FieldProvenanceRepository,
} from '@/features/aggregation/repositories/multi-source-repositories';
import type { ConflictResolutionService, ConflictResolutionDecision } from '@/features/aggregation/services/conflict-resolution-service';
import type { DuplicateDecisionService } from '@/features/aggregation/services/duplicate-decision-service';
import type { MergeContribution, MergeProvenanceService } from '@/features/aggregation/services/merge-provenance-service';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import { sourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import { sourceQualityResolver } from '@/features/sources/domain/source-quality-resolver';
import { mapSourceRecordToRegistryEntry } from '@/features/sources/domain/source-registry';
import type { SourceService } from '@/features/sources/services/source-service';

export interface DuplicateReviewContext {
  canonicalEventId: string;
  sourceReferences: SourceReference[];
  fieldProvenance: FieldProvenance[];
  conflicts: EventConflict[];
  duplicateDecisions: DuplicateDecision[];
}

export interface SourceDetailMultiSourceContext {
  sourceReferences: SourceReference[];
  provenanceCount: number;
  openConflicts: EventConflict[];
  duplicateDecisions: DuplicateDecision[];
  health: ReturnType<typeof sourceHealthResolver.resolve>;
  quality: ReturnType<typeof sourceQualityResolver.resolve>;
}

export class AdminMultiSourceService {
  constructor(
    private readonly sourceReferences: EventSourceReferenceRepository,
    private readonly fieldProvenance: FieldProvenanceRepository,
    private readonly conflicts: EventConflictRepository,
    private readonly duplicateDecisions: DuplicateDecisionRepository,
    private readonly duplicateDecisionService: DuplicateDecisionService,
    private readonly mergeProvenanceService: MergeProvenanceService,
    private readonly conflictResolutionService: ConflictResolutionService,
    private readonly sourceService: SourceService,
  ) {}

  async loadDuplicateReviewContext(canonicalEventId: string): Promise<DuplicateReviewContext> {
    const [sourceReferences, fieldProvenance, conflicts, duplicateDecisions] = await Promise.all([
      this.sourceReferences.findByCanonicalEventId(canonicalEventId),
      this.fieldProvenance.findByCanonicalEventId(canonicalEventId),
      this.conflicts.findByCanonicalEventId(canonicalEventId),
      this.duplicateDecisions.findByCanonicalEventId(canonicalEventId),
    ]);
    return { canonicalEventId, sourceReferences, fieldProvenance, conflicts, duplicateDecisions };
  }

  async decideDuplicate(input: {
    actorId: string;
    candidateIds: string[];
    sourceIds: string[];
    canonicalEventId?: string;
    decision: DuplicateDecision['decision'];
    reason: string;
    confidence?: number;
    contributions?: MergeContribution[];
  }): Promise<DuplicateDecision> {
    const saved = await this.duplicateDecisionService.decide({
      id: `dup-${input.candidateIds.join('-')}`,
      candidateIds: input.candidateIds,
      sourceIds: input.sourceIds,
      canonicalEventId: input.canonicalEventId,
      decision: input.decision,
      confidence: input.confidence ?? 1,
      reason: input.reason,
      decidedBy: input.actorId,
      decidedAt: new Date().toISOString(),
      fingerprintSnapshot: {},
      reversible: true,
    });

    if (input.decision === 'merged' && input.canonicalEventId && input.contributions?.length) {
      await this.mergeProvenanceService.merge({
        canonicalEventId: input.canonicalEventId,
        contributions: input.contributions,
        actorId: input.actorId,
      });
    }

    return saved;
  }

  async resolveConflict(input: {
    actorId: string;
    conflictId: string;
    decision: ConflictResolutionDecision;
    sourceId?: string;
    manualValue?: unknown;
  }) {
    return this.conflictResolutionService.resolve({
      conflictId: input.conflictId,
      decision: input.decision,
      actorId: input.actorId,
      sourceId: input.sourceId,
      manualValue: input.manualValue,
    });
  }

  async reopenConflict(conflictId: string, actorId: string) {
    return this.conflictResolutionService.reopen(conflictId, actorId);
  }

  async loadSourceDetailContext(role: AdminRole, sourceId: string): Promise<SourceDetailMultiSourceContext> {
    const sourceReferences = await this.sourceReferences.findBySourceId(sourceId);
    const canonicalIds = [...new Set(
      sourceReferences
        .map((reference) => reference.canonicalEventId)
        .filter((value): value is string => Boolean(value)),
    )];
    const provenanceLists = await Promise.all(
      canonicalIds.map((id) => this.fieldProvenance.findByCanonicalEventId(id)),
    );
    const conflictLists = await Promise.all(
      canonicalIds.map((id) => this.conflicts.listUnresolved(id)),
    );
    const duplicateDecisionLists = await Promise.all(
      canonicalIds.map((id) => this.duplicateDecisions.findByCanonicalEventId(id)),
    );
    const source = await this.sourceService.getByIdForAdmin(role, sourceId);
    const registryEntry = source ? mapSourceRecordToRegistryEntry(source) : null;
    return {
      sourceReferences,
      provenanceCount: provenanceLists.flat().length,
      openConflicts: conflictLists.flat(),
      duplicateDecisions: duplicateDecisionLists.flat(),
      health: registryEntry ? sourceHealthResolver.resolve(registryEntry) : sourceHealthResolver.resolve({
        ...mapSourceRecordToRegistryEntry({
          id: sourceId,
          slug: sourceId,
          displayName: sourceId,
          sourceType: 'manual',
          parserType: 'unknown',
          acquisitionStrategy: 'manual',
          priority: 50,
          trustScore: 50,
          requiresAuthentication: false,
          enabled: false,
          archived: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }),
      quality: sourceQualityResolver.resolve([]),
    };
  }
}
