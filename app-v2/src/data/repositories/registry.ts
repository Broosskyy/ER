import { bindEventRepository, bootstrapApp } from '@/core/bootstrap/app-bootstrap';
import { NotificationRepository } from '@/data/repositories/notification-repository';
import {
  AdminArtistRepository,
  AdminEventRepository,
  AdminVenueRepository,
  AdminOrganizerRepository,
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
import {
  ImportJobRepositoryImpl,
  ImportLogRepositoryImpl,
  ImportRecordRepositoryImpl,
  ImportSourceRepositoryImpl,
} from '@/data/repositories/import-repository-impl';
import { importAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import { registerImportAdapters } from '@/features/import/adapters/register-adapters';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import {
  ImportAdminRepositoryImpl,
  ImportAuditLogRepositoryImpl,
} from '@/data/repositories/import-admin-repository';
import { EventLineupService } from '@/features/events/services/event-lineup-service';
import { ArtistService } from '@/features/artists/services/artist-service';
import { VenueService } from '@/features/venues/services/venue-service';
import { OrganizerService } from '@/features/organizers/services/organizer-service';
import { AdminEventModerationService } from '@/features/admin/services/admin-event-moderation-service';
import { EventModerationAuditService } from '@/features/admin/services/event-moderation-audit-service';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportOperationsService } from '@/features/import/admin/import-operations-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';

registerImportAdapters(importAdapterRegistry);

export const eventRepository = new EventRepository();
bindEventRepository(eventRepository);

export const notificationRepository = new NotificationRepository(eventRepository);

export const adminEventRepository = new AdminEventRepository();
export const genreRepository = new GenreRepository();
export const cityRepository = new CityRepository();
export const venueRepository = new VenueRepository();
export const adminVenueRepository = new AdminVenueRepository();
export const venueService = new VenueService(adminVenueRepository);
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
export const importOperationsService = new ImportOperationsService(
  importSourceRepository,
  importJobRepository,
  importAdminRepository,
  importOrchestrator,
  importAdapterRegistry,
  importAuditService,
);
export const importReviewService = new ImportReviewService(
  importRecordRepository,
  importAdminRepository,
  adminEventRepository,
  importAuditService,
  eventLineupService,
);

export const eventModerationAuditService = new EventModerationAuditService();
export const adminEventModerationService = new AdminEventModerationService(
  adminEventRepository,
  eventModerationAuditService,
);

export { importAdapterRegistry };

export async function initializeRepositories(): Promise<void> {
  return bootstrapApp();
}

export type { EventSearchFilters } from '@/data/repositories/repositories';
