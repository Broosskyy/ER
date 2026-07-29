import { featureFlags } from '@/core/config/feature-flags';
import type { EventRepository } from '@/data/repositories/repositories';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';

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

async function hydrateFollowService(): Promise<void> {
  const { followService } = await import('@/data/repositories/registry');
  await followService.hydrate();
}

async function runBootstrap(): Promise<void> {
  const repository = getEventRepository();

  if (featureFlags.useSupabase) {
    await repository.initialize();
    await initializeEntityAliasStore();
    try {
      const { isSupabaseConfigured } = await import('@/core/config/env');
      if (isSupabaseConfigured()) {
        const { multiSourceRepositories } = await import('@/data/repositories/registry');
        repository.applyCanonicalAliases(await multiSourceRepositories.loadEventIdAliases());
      }
    } catch {
      repository.applyCanonicalAliases(new Map());
    }
    await hydrateFollowService();
    return;
  }

  // Consumer app loads only published database events — no demo pipeline fallback.
  repository.initializeSync([]);
  await hydrateFollowService();
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
