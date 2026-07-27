import { featureFlags } from '@/core/config/feature-flags';
import { ensureLocalContributorEventsHydrated } from '@/data/datasources/local/local-datasource';
import type { EventRepository } from '@/data/repositories/repositories';
import { runDefaultEventPipeline } from '@/features/events/pipeline/run-pipeline';

let eventRepositoryRef: EventRepository | undefined;
let bootstrapPromise: Promise<void> | undefined;
let bootstrapComplete = false;

export function bindEventRepository(repository: EventRepository): void {
  eventRepositoryRef = repository;
}

function getEventRepository(): EventRepository {
  if (!eventRepositoryRef) {
    throw new Error('EventRepository is not bound to app bootstrap.');
  }
  return eventRepositoryRef;
}

async function runBootstrap(): Promise<void> {
  const repository = getEventRepository();

  if (featureFlags.useSupabase) {
    await repository.initialize();
    try {
      const { isSupabaseConfigured } = await import('@/core/config/env');
      if (isSupabaseConfigured()) {
        const { multiSourceRepositories } = await import('@/data/repositories/registry');
        repository.applyCanonicalAliases(await multiSourceRepositories.loadEventIdAliases());
      }
    } catch {
      repository.applyCanonicalAliases(new Map());
    }
    return;
  }

  await ensureLocalContributorEventsHydrated();
  const report = runDefaultEventPipeline();
  repository.initializeSync(report.publishedEvents);
}

export function isAppBootstrapped(): boolean {
  return bootstrapComplete;
}

export async function bootstrapApp(): Promise<void> {
  if (bootstrapComplete) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap()
      .then(() => {
        bootstrapComplete = true;
      })
      .catch((error: unknown) => {
        bootstrapPromise = undefined;
        throw error;
      });
  }

  return bootstrapPromise;
}

export function resetAppBootstrap(): void {
  bootstrapComplete = false;
  bootstrapPromise = undefined;
  eventRepositoryRef?.resetForTesting();
}

export function assertAppBootstrapped(): void {
  if (!bootstrapComplete) {
    throw new Error('App bootstrap is not complete. Wait for bootstrapApp() before using EventRepository.');
  }
}
