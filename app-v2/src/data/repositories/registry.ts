import { featureFlags } from '@/core/config/feature-flags';
import { runDefaultEventPipeline } from '@/features/events/pipeline/run-pipeline';
import {
  AdminEventRepository,
  ArtistRepository,
  CityRepository,
  CollectionRepository,
  EventRepository,
  GenreRepository,
  SourceRepository,
  StatsRepository,
  VenueRepository,
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

registerImportAdapters(importAdapterRegistry);

export const eventRepository = new EventRepository();
export const adminEventRepository = new AdminEventRepository();
export const genreRepository = new GenreRepository();
export const cityRepository = new CityRepository();
export const venueRepository = new VenueRepository();
export const artistRepository = new ArtistRepository();
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

export { importAdapterRegistry };

let initialized = false;
let initPromise: Promise<void> | undefined;

if (!featureFlags.useSupabase) {
  const report = runDefaultEventPipeline();
  eventRepository.initializeSync(report.publishedEvents);
  initialized = true;
}

export async function initializeRepositories(): Promise<void> {
  if (initialized) {
    return;
  }
  if (!initPromise) {
    initPromise = eventRepository.initialize().then(() => {
      initialized = true;
    });
  }
  return initPromise;
}

export type { EventSearchFilters } from '@/data/repositories/repositories';
