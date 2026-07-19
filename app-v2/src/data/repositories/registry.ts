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

export const eventRepository = new EventRepository();
export const adminEventRepository = new AdminEventRepository();
export const genreRepository = new GenreRepository();
export const cityRepository = new CityRepository();
export const venueRepository = new VenueRepository();
export const artistRepository = new ArtistRepository();
export const collectionRepository = new CollectionRepository();
export const sourceRepository = new SourceRepository();
export const statsRepository = new StatsRepository();

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
