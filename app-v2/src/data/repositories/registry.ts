import type { SourceRecord } from '@/data/types/records';
import { bindEventRepository, bootstrapApp } from '@/core/bootstrap/app-bootstrap';
import {
  ImportAdminRepositoryImpl,
  ImportAuditLogRepositoryImpl,
} from '@/data/repositories/import-admin-repository';
import {
  ImportJobRepositoryImpl,
  ImportLogRepositoryImpl,
  ImportRecordRepositoryImpl,
  ImportSourceRepositoryImpl,
} from '@/data/repositories/import-repository-impl';
import { NotificationRepository } from '@/data/repositories/notification-repository';
import {
  AdminArtistRepository,
  AdminEventRepository,
  AdminVenueRepository,
  AdminOrganizerRepository,
  AdminSourceRepository,
  ArtistRepository,
  CityRepository,
  CollectionRepository,
  EventLineupRepository,
  EventRepository,
  GenreRepository,
  SourceRepository,
  StatsRepository,
  VenueRepository,
  OrganizerRepository,
} from '@/data/repositories/repositories';
import { bindDiscoverableEventRepository } from '@/features/events/discovery/discovery-feed-helpers';
import { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { OptimizedDiscoveryEventSource } from '@/features/discovery/repository/optimized-discovery-event-source';
import { createDiscoverySourceTrustProvider } from '@/features/discovery/trust/discovery-source-trust';
import { bindDiscoveryPlatform } from '@/features/discovery/discovery-platform-bindings';
import { bindDiscoveryServices } from '@/features/discovery/discovery-runtime';
import { AdminEventModerationService } from '@/features/admin/services/admin-event-moderation-service';
import { AdminModerationStateService } from '@/features/admin/services/admin-moderation-state-service';
import { AdminMultiSourceService } from '@/features/admin/services/admin-multi-source-service';
import { EventModerationAuditService } from '@/features/admin/services/event-moderation-audit-service';
import { SupabaseMultiSourceRepositories } from '@/features/aggregation/repositories/multi-source-repositories';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { ArtistService } from '@/features/artists/services/artist-service';
import { EventLineupService } from '@/features/events/services/event-lineup-service';
import { importAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import { registerImportAdapters } from '@/features/import/adapters/register-adapters';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { createEntityAliasStore } from '@/features/entity-resolution/create-entity-alias-store';
import { InMemoryRealDataDomainEventBus } from '@/features/events/domain/real-data-domain-events';
import {
  AsyncStorageFollowStorage,
  FollowService,
  type FollowEntityType,
  type FollowStorage,
  InMemoryFollowStorage,
} from '@/features/follows/follow-service';
import { EntityResolutionWritebackService } from '@/features/entity-resolution/entity-resolution-writeback-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import { OrganizerService } from '@/features/organizers/services/organizer-service';
import { SourceService } from '@/features/sources/services/source-service';
import { SourceManagementService } from '@/features/sources/services/source-management-service';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { VenueService } from '@/features/venues/services/venue-service';
import { ImportOperationsService } from '@/features/import/admin/import-operations-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import {
  createEventFingerprintLookup,
  EventCanonicalIdentityService,
} from '@/features/events/services/event-canonical-identity-service';
import { DefaultImportScheduleService } from '@/features/import/scheduling/import-schedule-service';
import { SourceBackedImportScheduleRepository } from '@/features/import/scheduling/source-import-schedule-repository';
import {
  InMemoryImportJobQueueRepository,
  InMemorySchedulerRunRepository,
  InMemoryWorkerRunRepository,
} from '@/features/import/scheduling/in-memory-scheduler-repositories';
import {
  SupabaseImportJobQueueRepository,
  SupabaseSchedulerRunRepository,
  SupabaseWorkerRunRepository,
} from '@/features/import/scheduling/supabase-scheduler-repositories';
import { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import { ImportJobQueueProcessor } from '@/features/import/scheduling/import-job-queue-processor';
import { ImportSchedulerEngine } from '@/features/import/scheduling/import-scheduler-engine';
import { ImportSchedulerMonitoringService } from '@/features/import/scheduling/import-scheduler-monitoring';
import { ImportSchedulerAdminService } from '@/features/import/scheduling/import-scheduler-admin-service';
import { shouldUseAggregationForSource } from '@/features/import/scheduling/scheduler-source-utils';
import {
  InMemoryImportReviewQueueRepository,
  InMemorySourceReputationRepository,
  InMemoryTrustQualityRuleRepository,
} from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import {
  SupabaseImportReviewQueueRepository,
  SupabaseSourceReputationRepository,
  SupabaseTrustQualityRuleRepository,
} from '@/features/trust-quality/repositories/supabase-trust-quality-repositories';
import { TrustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';
import { ImportRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { SourceTrustEngine } from '@/features/trust-quality/services/source-trust-engine';
import { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import { SourceReputationService } from '@/features/trust-quality/services/source-reputation-service';
import { TrustQualityAdminService } from '@/features/trust-quality/services/trust-quality-admin-service';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import {
  InMemoryEventBlockingKeyRepository,
  InMemoryEventMatchEvaluationRepository,
  InMemoryEventMergeCandidateRepository,
} from '@/features/multi-source-matching/repositories/in-memory-matching-repositories';
import {
  SupabaseEventBlockingKeyRepository,
  SupabaseEventMatchEvaluationRepository,
  SupabaseEventMergeCandidateRepository,
} from '@/features/multi-source-matching/repositories/supabase-matching-repositories';
import { MultiSourceMatchScorer } from '@/features/multi-source-matching/services/multi-source-match-scorer';
import { MatchConflictDetector } from '@/features/multi-source-matching/services/match-conflict-detector';
import { MultiSourceMatchEngine } from '@/features/multi-source-matching/services/multi-source-match-engine';
import { MultiSourceMatchOrchestrator } from '@/features/multi-source-matching/services/multi-source-match-orchestrator';
import { MultiSourceMatchAdminService } from '@/features/multi-source-matching/services/multi-source-match-admin-service';
import {
  InMemoryEventLifecycleChangeRepository,
  InMemoryEventLifecycleHistoryRepository,
} from '@/features/event-lifecycle/repositories/in-memory-lifecycle-repositories';
import {
  SupabaseEventLifecycleChangeRepository,
  SupabaseEventLifecycleHistoryRepository,
} from '@/features/event-lifecycle/repositories/supabase-lifecycle-repositories';
import { EventLifecycleChangeDetector } from '@/features/event-lifecycle/services/event-lifecycle-change-detector';
import { EventLifecycleDecisionEngine } from '@/features/event-lifecycle/services/event-lifecycle-decision-engine';
import { EventLifecycleEngine } from '@/features/event-lifecycle/services/event-lifecycle-engine';
import { EventLifecycleOrchestrator } from '@/features/event-lifecycle/services/event-lifecycle-orchestrator';
import { EventLifecycleAdminService } from '@/features/event-lifecycle/services/event-lifecycle-admin-service';
import { DuplicateDecisionService } from '@/features/aggregation/services/duplicate-decision-service';
import { MergeProvenanceService } from '@/features/aggregation/services/merge-provenance-service';
import { ConflictResolutionService } from '@/features/aggregation/services/conflict-resolution-service';
import { priorityBasedMergeStrategy } from '@/features/aggregation/merge/merge-strategy';
import { eventQualityResolver } from '@/features/events/quality/event-quality-resolver';
import { publishReadinessResolver } from '@/features/events/quality/publish-readiness-resolver';
import { CanonicalEventIdResolver } from '@/features/events/services/canonical-event-id-resolver';
import { registerConnectors } from '@/features/connectors/register-connectors';
import { connectorRegistry } from '@/features/connectors/registry/connector-registry';
import { ConnectorFactory } from '@/features/connectors/registry/connector-factory';
import { ConnectorFrameworkService } from '@/features/connectors/services/connector-framework-service';
import { ConnectorAdminService } from '@/features/connectors/services/connector-admin-service';
import { connectorConfigStore } from '@/features/connectors/admin/connector-config-store';
import { ConnectorExecutionService } from '@/features/connectors/services/connector-execution-service';
import { ConnectorExecutionEngine } from '@/features/connectors/services/connector-execution-engine';
import { SourceConfigEndpointExecutionLoader } from '@/features/connectors/domain/endpoint-execution-loader';
import { InMemoryConnectorExecutionRepository } from '@/features/connectors/repositories/connector-execution-repository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveCanonicalEntityId } from '@/features/profiles/services/canonical-entity-id-resolver';
import { ImportJobQueueWorker } from '@/features/operations/services/import-job-queue-worker';
import {
  OperationsControlService,
  OperationsTriggerService,
} from '@/features/operations/services/operations-control-service';
import { SourceIntelligenceService } from '@/features/operations/services/source-intelligence-service';
import { ProductionOperationsMonitoringService } from '@/features/operations/services/production-operations-monitoring-service';
import { BackfillRunner } from '@/features/operations/backfill/backfill-runner';
import {
  createBlockingKeysBackfillHandler,
  createLifecycleHistoryBackfillHandler,
  createProvenanceBackfillHandler,
  createSourceIntelligenceBackfillHandler,
} from '@/features/operations/backfill/backfill-handlers';
import { createEventOriginsBackfillHandler } from '@/features/operations/backfill/event-origins-backfill-handler';
import { EventOriginService } from '@/features/events/services/event-origin-service';
import { EventDetailService } from '@/features/events/services/event-detail-service';
import { InMemorySourceOnboardingRepository } from '@/features/source-onboarding/repositories/source-onboarding-repository';
import { SupabaseSourceOnboardingRepository } from '@/features/source-onboarding/repositories/supabase-source-onboarding-repository';
import { SourceOnboardingService } from '@/features/source-onboarding/services/source-onboarding-service';
import { WorkerRecoveryService } from '@/features/operations/services/worker-recovery-service';
import { ConnectorHealthPersistenceService } from '@/features/operations/services/connector-health-persistence-service';
import {
  InMemoryConnectorHealthSnapshotRepository,
  InMemoryOperationsBackfillJobRepository,
  InMemoryPlatformOperationsStateRepository,
  InMemorySourceIntelligenceSnapshotRepository,
  InMemoryWorkerRecoveryRunRepository,
} from '@/features/operations/repositories/in-memory-operations-repositories';
import {
  SupabaseConnectorHealthSnapshotRepository,
  SupabaseOperationsBackfillJobRepository,
  SupabasePlatformOperationsStateRepository,
  SupabaseSourceIntelligenceSnapshotRepository,
  SupabaseWorkerRecoveryRunRepository,
} from '@/features/operations/repositories/supabase-operations-repositories';

registerImportAdapters(importAdapterRegistry);
registerConnectors(connectorRegistry);

export const eventRepository = new EventRepository();
bindDiscoverableEventRepository(eventRepository);
bindEventRepository(eventRepository);

export const notificationRepository = new NotificationRepository(eventRepository);

export const adminEventRepository = new AdminEventRepository();
export const genreRepository = new GenreRepository();
export const cityRepository = new CityRepository();
export const venueRepository = new VenueRepository();
export const adminVenueRepository = new AdminVenueRepository();
export const venueService = new VenueService(adminVenueRepository);
export const adminSourceRepository = new AdminSourceRepository();
export const sourceService = new SourceService(adminSourceRepository);
export const sourceManagementService = new SourceManagementService(
  sourceService,
  sourceConnectorRegistry,
);
export const organizerRepository = new OrganizerRepository();
export const adminOrganizerRepository = new AdminOrganizerRepository();
export const organizerService = new OrganizerService(adminOrganizerRepository);
export const artistRepository = new ArtistRepository();
export const adminArtistRepository = new AdminArtistRepository();
export const artistService = new ArtistService(artistRepository, adminArtistRepository);
export const eventLineupRepository = new EventLineupRepository();
export const eventLineupService = new EventLineupService(
  eventLineupRepository,
  () => adminArtistRepository.getAll(),
  async (id) => adminEventRepository.getById(id),
);
export const collectionRepository = new CollectionRepository();
export const sourceRepository = new SourceRepository();
export const statsRepository = new StatsRepository();

export const importSourceRepository = new ImportSourceRepositoryImpl();
export const importJobRepository = new ImportJobRepositoryImpl();
export const importRecordRepository = new ImportRecordRepositoryImpl();
export const importLogRepository = new ImportLogRepositoryImpl();
export const importLoggingService = new ImportLoggingService(importLogRepository);
export const realDataDomainEventBus = new InMemoryRealDataDomainEventBus();

async function resolveFollowCanonicalEntityId(
  entityType: FollowEntityType,
  entityId: string,
): Promise<string> {
  if (entityType === 'organizer') {
    return resolveCanonicalEntityId('organizer', entityId, async (id) =>
      Boolean(await organizerRepository.getById(id)),
    );
  }
  if (entityType === 'venue') {
    return resolveCanonicalEntityId('venue', entityId, async (id) =>
      Boolean(await venueRepository.getById(id)),
    );
  }
  return resolveCanonicalEntityId('artist', entityId, async (id) =>
    Boolean(await artistRepository.getPublishedById(id)),
  );
}

function createFollowStorage(): FollowStorage {
  if (process.env.VITEST === 'true') {
    return new InMemoryFollowStorage();
  }
  return new AsyncStorageFollowStorage(AsyncStorage);
}

export const followService = new FollowService({
  storage: createFollowStorage(),
  domainEventBus: realDataDomainEventBus,
  resolveCanonicalId: resolveFollowCanonicalEntityId,
});
const entityAliasStoreInstance = createEntityAliasStore();
const importMatchingBundle = createImportMatchingService(entityAliasStoreInstance);
export const importMatchingService = importMatchingBundle.matchingService;
export const entityAliasStore = importMatchingBundle.aliasStore;
export const entityResolutionWritebackService = new EntityResolutionWritebackService(
  entityAliasStoreInstance,
);
export const importOrchestrator = new ImportOrchestrator(
  importSourceRepository,
  importJobRepository,
  importRecordRepository,
  importAdapterRegistry,
  importLoggingService,
  importMatchingService,
);

export const importAuditLogRepository = new ImportAuditLogRepositoryImpl();
export const importAdminRepository = new ImportAdminRepositoryImpl();
export const importAuditService = new ImportAuditService(importAuditLogRepository);
export const multiSourceRepositories = new SupabaseMultiSourceRepositories();
export const duplicateDecisionService = new DuplicateDecisionService(
  multiSourceRepositories.duplicateDecisions,
  importAuditLogRepository,
);
export const mergeProvenanceService = new MergeProvenanceService(
  adminEventRepository,
  eventRepository,
  multiSourceRepositories.sourceReferences,
  multiSourceRepositories.fieldProvenance,
  multiSourceRepositories.conflicts,
  priorityBasedMergeStrategy,
  eventQualityResolver,
  publishReadinessResolver,
  importAuditLogRepository,
);
export const conflictResolutionService = new ConflictResolutionService(
  adminEventRepository,
  eventRepository,
  multiSourceRepositories.conflicts,
  multiSourceRepositories.fieldProvenance,
  eventQualityResolver,
  publishReadinessResolver,
  importAuditLogRepository,
);
export const canonicalEventIdResolver = new CanonicalEventIdResolver({
  findCanonicalId: async (eventId) => {
    const aliases = await multiSourceRepositories.loadEventIdAliases();
    return aliases.get(eventId) ?? null;
  },
});
export const adminMultiSourceService = new AdminMultiSourceService(
  multiSourceRepositories.sourceReferences,
  multiSourceRepositories.fieldProvenance,
  multiSourceRepositories.conflicts,
  multiSourceRepositories.duplicateDecisions,
  duplicateDecisionService,
  mergeProvenanceService,
  conflictResolutionService,
  sourceService,
);
export const eventOriginService = new EventOriginService(multiSourceRepositories.sourceReferences);
export const eventDetailService = new EventDetailService(
  (id) => eventRepository.getEventById(id),
  eventOriginService,
);
const eventCanonicalIdentityService = new EventCanonicalIdentityService(
  createEventFingerprintLookup(entityAliasStore),
  multiSourceRepositories.sourceReferences,
);
const useInMemoryPersistence = process.env.VITEST === 'true';

const sourceOnboardingRepository = useInMemoryPersistence
  ? new InMemorySourceOnboardingRepository()
  : new SupabaseSourceOnboardingRepository();
export const sourceOnboardingService = new SourceOnboardingService(
  sourceOnboardingRepository,
  async () => {
    const sources = await adminSourceRepository.getAll();
    return sources.flatMap((source) => {
      const urls = [source.baseUrl, source.website, source.sourceUrl].filter(
        (value): value is string => Boolean(value),
      );
      const seen = new Set<string>();
      const entries: Array<{ hostname: string; sourceId: string }> = [];
      for (const value of urls) {
        try {
          const hostname = new URL(value).hostname;
          const key = hostname.toLowerCase().replace(/^www\./, '');
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          entries.push({ hostname, sourceId: source.id });
        } catch {
          continue;
        }
      }
      return entries;
    });
  },
);

const eventBlockingKeyRepository = useInMemoryPersistence
  ? new InMemoryEventBlockingKeyRepository()
  : new SupabaseEventBlockingKeyRepository();
const eventMatchEvaluationRepository = useInMemoryPersistence
  ? new InMemoryEventMatchEvaluationRepository()
  : new SupabaseEventMatchEvaluationRepository();
const eventMergeCandidateRepository = useInMemoryPersistence
  ? new InMemoryEventMergeCandidateRepository()
  : new SupabaseEventMergeCandidateRepository();
export const multiSourceMatchEngine = new MultiSourceMatchEngine(
  adminEventRepository,
  multiSourceRepositories.sourceReferences,
  eventBlockingKeyRepository,
  eventCanonicalIdentityService,
  new MultiSourceMatchScorer(),
  new MatchConflictDetector(),
);
const trustQualityRuleRepository = useInMemoryPersistence
  ? new InMemoryTrustQualityRuleRepository()
  : new SupabaseTrustQualityRuleRepository();
const importReviewQueueRepository = useInMemoryPersistence
  ? new InMemoryImportReviewQueueRepository()
  : new SupabaseImportReviewQueueRepository();
const sourceReputationRepository = useInMemoryPersistence
  ? new InMemorySourceReputationRepository()
  : new SupabaseSourceReputationRepository();
const sourceTrustEngineInstance = new SourceTrustEngine();
export const publishDecisionService = new PublishDecisionService(
  new TrustPublishDecisionEngine(new ImportRecordQualityEvaluator(), sourceTrustEngineInstance),
  trustQualityRuleRepository,
);
export const importReviewQueueService = new ImportReviewQueueService(importReviewQueueRepository);
export const sourceReputationService = new SourceReputationService(
  adminSourceRepository,
  sourceReputationRepository,
  sourceTrustEngineInstance,
);
export const trustQualityAdminService = new TrustQualityAdminService(
  adminSourceRepository,
  trustQualityRuleRepository,
  importReviewQueueService,
  sourceReputationService,
  sourceTrustEngineInstance,
  sourceReputationRepository,
);
export const multiSourceMatchOrchestrator = new MultiSourceMatchOrchestrator(
  multiSourceMatchEngine,
  eventMatchEvaluationRepository,
  eventMergeCandidateRepository,
  eventBlockingKeyRepository,
  importRecordRepository,
  importReviewQueueService,
  duplicateDecisionService,
  multiSourceRepositories.conflicts,
);
export const multiSourceMatchAdminService = new MultiSourceMatchAdminService(
  adminSourceRepository,
  eventMatchEvaluationRepository,
  eventMergeCandidateRepository,
);
const eventLifecycleHistoryRepository = useInMemoryPersistence
  ? new InMemoryEventLifecycleHistoryRepository()
  : new SupabaseEventLifecycleHistoryRepository();
const eventLifecycleChangeRepository = useInMemoryPersistence
  ? new InMemoryEventLifecycleChangeRepository()
  : new SupabaseEventLifecycleChangeRepository();
export const eventLifecycleEngine = new EventLifecycleEngine(
  new EventLifecycleChangeDetector(),
  new EventLifecycleDecisionEngine(),
  eventLifecycleHistoryRepository,
  eventLifecycleChangeRepository,
);
export const eventLifecycleOrchestrator = new EventLifecycleOrchestrator(
  eventLifecycleEngine,
  realDataDomainEventBus,
  importReviewQueueService,
  multiSourceRepositories.conflicts,
);
export const eventLifecycleAdminService = new EventLifecycleAdminService(
  adminSourceRepository,
  eventLifecycleHistoryRepository,
  eventLifecycleChangeRepository,
);
export const importEventPublishService = new ImportEventPublishService(
  importRecordRepository,
  adminEventRepository,
  multiSourceRepositories.sourceReferences,
  eventRepository,
  new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance),
  eventCanonicalIdentityService,
  eventLifecycleOrchestrator,
  eventOriginService,
);
export const importPublishOrchestratorService = new ImportPublishOrchestratorService(
  importRecordRepository,
  importEventPublishService,
  publishDecisionService,
  importLoggingService,
  importReviewQueueService,
  sourceReputationService,
  multiSourceMatchOrchestrator,
  adminEventRepository,
);
export const importAggregationService = new ImportAggregationService(
  importSourceRepository,
  importJobRepository,
  importRecordRepository,
  importLoggingService,
  adminEventRepository,
  importMatchingService,
  undefined,
  undefined,
  importPublishOrchestratorService,
  multiSourceMatchOrchestrator,
  eventLifecycleOrchestrator,
  sourceReputationService,
);

const importScheduleRepository = new SourceBackedImportScheduleRepository(adminSourceRepository);
const importScheduleService = new DefaultImportScheduleService(importScheduleRepository);
const importJobQueueRepository = useInMemoryPersistence
  ? new InMemoryImportJobQueueRepository()
  : new SupabaseImportJobQueueRepository();
const schedulerRunRepository = useInMemoryPersistence
  ? new InMemorySchedulerRunRepository()
  : new SupabaseSchedulerRunRepository();
const workerRunRepository = useInMemoryPersistence
  ? new InMemoryWorkerRunRepository()
  : new SupabaseWorkerRunRepository();
const platformOperationsStateRepository = useInMemoryPersistence
  ? new InMemoryPlatformOperationsStateRepository()
  : new SupabasePlatformOperationsStateRepository();
const operationsBackfillJobRepository = useInMemoryPersistence
  ? new InMemoryOperationsBackfillJobRepository()
  : new SupabaseOperationsBackfillJobRepository();
export { operationsBackfillJobRepository };
const sourceIntelligenceSnapshotRepository = useInMemoryPersistence
  ? new InMemorySourceIntelligenceSnapshotRepository()
  : new SupabaseSourceIntelligenceSnapshotRepository();
const connectorHealthSnapshotRepository = useInMemoryPersistence
  ? new InMemoryConnectorHealthSnapshotRepository()
  : new SupabaseConnectorHealthSnapshotRepository();
const workerRecoveryRunRepository = useInMemoryPersistence
  ? new InMemoryWorkerRecoveryRunRepository()
  : new SupabaseWorkerRecoveryRunRepository();
const eventFieldProvenanceWriter = new EventFieldProvenanceWriter(
  multiSourceRepositories.fieldProvenance,
);
const importJobQueueService = new ImportJobQueueService(importJobQueueRepository);
const importJobQueueProcessor = new ImportJobQueueProcessor(
  importJobQueueService,
  importJobRepository,
  importAdminRepository,
  importAggregationService,
  importScheduleService,
  importLoggingService,
  async (sourceId) => adminSourceRepository.getById(sourceId),
  shouldUseAggregationForSource,
);
export const importSchedulerEngine = new ImportSchedulerEngine(
  importScheduleService,
  importScheduleRepository,
  schedulerRunRepository,
  importJobQueueService,
  importJobQueueProcessor,
  importAggregationService,
  importAdminRepository,
  importLoggingService,
  async (sourceId) => adminSourceRepository.getById(sourceId),
  shouldUseAggregationForSource,
);
export const importSchedulerMonitoringService = new ImportSchedulerMonitoringService(
  importScheduleRepository,
  schedulerRunRepository,
  importJobQueueRepository,
  async (sourceId) => Boolean(await importAdminRepository.getActiveJobForSource(sourceId)),
);
export const importSchedulerAdminService = new ImportSchedulerAdminService(
  sourceService,
  adminSourceRepository,
  importScheduleRepository,
  importScheduleService,
  importSchedulerEngine,
  importSchedulerMonitoringService,
);
export const importJobQueueWorker = new ImportJobQueueWorker(
  importJobQueueProcessor,
  workerRunRepository,
  platformOperationsStateRepository,
);
export const workerRecoveryService = new WorkerRecoveryService(
  importJobQueueService,
  importScheduleRepository,
  workerRunRepository,
  workerRecoveryRunRepository,
);
export const connectorHealthPersistenceService = new ConnectorHealthPersistenceService(
  connectorHealthSnapshotRepository,
);
export const operationsControlService = new OperationsControlService(
  platformOperationsStateRepository,
  importJobQueueService,
  workerRecoveryService,
  operationsBackfillJobRepository,
);
export const operationsTriggerService = new OperationsTriggerService(
  importSchedulerEngine,
  importJobQueueWorker,
  platformOperationsStateRepository,
  operationsControlService,
);
export const sourceIntelligenceService = new SourceIntelligenceService(
  adminSourceRepository,
  sourceIntelligenceSnapshotRepository,
  importScheduleRepository,
  importJobQueueRepository,
  importReviewQueueRepository,
  eventMatchEvaluationRepository,
  eventLifecycleHistoryRepository,
);
export const productionOperationsMonitoringService = new ProductionOperationsMonitoringService(
  importSchedulerMonitoringService,
  workerRunRepository,
  platformOperationsStateRepository,
  importJobQueueRepository,
  importReviewQueueRepository,
  eventMergeCandidateRepository,
  eventLifecycleHistoryRepository,
  workerRecoveryRunRepository,
  connectorHealthSnapshotRepository,
  operationsBackfillJobRepository,
  importJobQueueService,
);
export const backfillRunner = new BackfillRunner(operationsBackfillJobRepository, [
  createBlockingKeysBackfillHandler(adminEventRepository, eventBlockingKeyRepository),
  createLifecycleHistoryBackfillHandler(
    adminEventRepository,
    eventLifecycleEngine,
    eventLifecycleHistoryRepository,
  ),
  createProvenanceBackfillHandler(
    adminEventRepository,
    multiSourceRepositories.sourceReferences,
    eventFieldProvenanceWriter,
  ),
  createEventOriginsBackfillHandler(
    adminEventRepository,
    adminSourceRepository,
    multiSourceRepositories.sourceReferences,
    importRecordRepository,
  ),
  createSourceIntelligenceBackfillHandler(sourceIntelligenceService),
]);
export const importOperationsService = new ImportOperationsService(
  importSourceRepository,
  sourceService,
  importJobRepository,
  importAdminRepository,
  importOrchestrator,
  importAdapterRegistry,
  importAuditService,
  importAggregationService,
);
export const importReviewService = new ImportReviewService(
  importRecordRepository,
  importAdminRepository,
  adminEventRepository,
  importAuditService,
  eventLineupService,
  eventRepository,
  importMatchingService,
  undefined,
  entityResolutionWritebackService,
  realDataDomainEventBus,
  multiSourceRepositories.sourceReferences,
);

export const eventModerationAuditService = new EventModerationAuditService();
export const adminModerationStateService = new AdminModerationStateService();
export const adminEventModerationService = new AdminEventModerationService(
  adminEventRepository,
  eventModerationAuditService,
  adminModerationStateService,
);

export { importAdapterRegistry, connectorRegistry };

export const connectorFactory = new ConnectorFactory(connectorRegistry);
export const connectorFrameworkService = new ConnectorFrameworkService(
  connectorRegistry,
  connectorFactory,
);

const connectorExecutionRepository = new InMemoryConnectorExecutionRepository();
const endpointExecutionLoader = new SourceConfigEndpointExecutionLoader(adminSourceRepository);
export const connectorExecutionEngine = new ConnectorExecutionEngine(
  endpointExecutionLoader,
  connectorRegistry,
  connectorFrameworkService,
  connectorExecutionRepository,
);
export const connectorExecutionService = new ConnectorExecutionService(connectorExecutionEngine);

export const connectorAdminService = new ConnectorAdminService(
  connectorFrameworkService,
  connectorRegistry,
  connectorConfigStore,
  sourceService,
  sourceService,
);

export const discoveryEngine = new DiscoveryEngine({
  eventSource: new OptimizedDiscoveryEventSource(new InMemoryDiscoveryEventSource()),
  resolveCanonicalId: (eventId) => eventRepository.resolveCanonicalId(eventId),
  sourceTrustProvider: createDiscoverySourceTrustProvider(async (sourceIds) => {
    const records = await Promise.all(sourceIds.map((id) => adminSourceRepository.getById(id)));
    return records.filter((record): record is SourceRecord => record !== null);
  }),
});
export const discoveryApiService = new DiscoveryApiService(discoveryEngine);
export const { queryPlatform: discoveryQueryPlatform, httpAdapter: discoveryHttpAdapter } =
  bindDiscoveryPlatform(discoveryEngine, discoveryApiService, {
    eventRepository,
    venueRepository,
    organizerRepository,
    loadEventOrigins: async (eventId) => {
      const origins = await eventOriginService.listByEventId(eventId);
      return origins.map((origin) => ({
        id: origin.id,
        sourceId: origin.sourceId,
        platform: origin.platform,
        role: origin.role,
        ticketUrl: origin.ticketUrl,
        eventUrl: origin.eventUrl,
        syncStatus: origin.syncStatus,
        isPrimary: origin.isPrimary,
        isActive: origin.isActive,
      }));
    },
  });

export async function initializeRepositories(): Promise<void> {
  return bootstrapApp();
}

export type { EventSearchFilters } from '@/data/repositories/repositories';
