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
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import { OrganizerService } from '@/features/organizers/services/organizer-service';
import { SourceService } from '@/features/sources/services/source-service';
import { VenueService } from '@/features/venues/services/venue-service';
import { ImportOperationsService } from '@/features/import/admin/import-operations-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
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

registerImportAdapters(importAdapterRegistry);
registerConnectors(connectorRegistry);

export const eventRepository = new EventRepository();
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
export const importOrchestrator = new ImportOrchestrator(
  importSourceRepository,
  importJobRepository,
  importRecordRepository,
  importAdapterRegistry,
  importLoggingService,
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
export const importAggregationService = new ImportAggregationService(
  importSourceRepository,
  importJobRepository,
  importRecordRepository,
  importLoggingService,
  adminEventRepository,
);
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

export async function initializeRepositories(): Promise<void> {
  return bootstrapApp();
}

export type { EventSearchFilters } from '@/data/repositories/repositories';
