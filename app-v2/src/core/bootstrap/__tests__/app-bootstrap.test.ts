import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertAppBootstrapped,
  bindEventRepository,
  bootstrapApp,
  isAppBootstrapped,
  resetAppBootstrap,
} from '@/core/bootstrap/app-bootstrap';
import { EventRepository } from '@/data/repositories/repositories';

const featureFlagsMock = vi.hoisted(() => ({
  useSupabase: false,
}));

vi.mock('@/core/config/feature-flags', () => ({
  featureFlags: featureFlagsMock,
}));

describe('app bootstrap', () => {
  let repository: EventRepository;
  let initializeSpy: ReturnType<typeof vi.spyOn>;
  let initializeSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    repository = new EventRepository();
    bindEventRepository(repository);
    initializeSpy = vi.spyOn(repository, 'initialize');
    initializeSyncSpy = vi.spyOn(repository, 'initializeSync');
    featureFlagsMock.useSupabase = false;
    resetAppBootstrap();
  });

  afterEach(() => {
    resetAppBootstrap();
    vi.restoreAllMocks();
  });

  it('prevents repository access before bootstrap completes', () => {
    expect(() => repository.getPublishedEvents()).toThrow(
      'EventRepository is not initialized. Call initialize() first.',
    );
    expect(() => assertAppBootstrapped()).toThrow(
      'App bootstrap is not complete. Wait for bootstrapApp() before using EventRepository.',
    );
  });

  it('bootstraps successfully in local mode', async () => {
    await bootstrapApp();

    expect(isAppBootstrapped()).toBe(true);
    expect(initializeSyncSpy).toHaveBeenCalledTimes(1);
    expect(initializeSpy).not.toHaveBeenCalled();
    expect(repository.getPublishedEvents().length).toBeGreaterThan(0);
    expect(() => assertAppBootstrapped()).not.toThrow();
  });

  it('bootstraps successfully in supabase mode', async () => {
    featureFlagsMock.useSupabase = true;
    initializeSpy.mockResolvedValue(undefined);
    initializeSyncSpy.mockImplementation(() => {
      repository.initializeSync([]);
    });

    await bootstrapApp();

    expect(isAppBootstrapped()).toBe(true);
    expect(initializeSpy).toHaveBeenCalledTimes(1);
    expect(initializeSyncSpy).not.toHaveBeenCalled();
  });

  it('surfaces bootstrap failures without marking bootstrap complete', async () => {
    featureFlagsMock.useSupabase = true;
    initializeSpy.mockRejectedValue(new Error('Supabase unavailable'));

    await expect(bootstrapApp()).rejects.toThrow('Supabase unavailable');
    expect(isAppBootstrapped()).toBe(false);
    expect(() => repository.getPublishedEvents()).toThrow(
      'EventRepository is not initialized. Call initialize() first.',
    );
  });

  it('retries bootstrap after a failed attempt', async () => {
    featureFlagsMock.useSupabase = true;
    initializeSpy
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockImplementationOnce(async () => {
        repository.initializeSync([]);
      });

    await expect(bootstrapApp()).rejects.toThrow('temporary outage');
    resetAppBootstrap();

    await bootstrapApp();

    expect(isAppBootstrapped()).toBe(true);
    expect(initializeSpy).toHaveBeenCalledTimes(2);
  });

  it('deduplicates parallel bootstrap calls into a single initialize execution', async () => {
    featureFlagsMock.useSupabase = true;
    let releaseInitialize: (() => void) | undefined;
    initializeSpy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseInitialize = () => {
            repository.initializeSync([]);
            resolve();
          };
        }),
    );

    const first = bootstrapApp();
    const second = bootstrapApp();

    expect(initializeSpy).toHaveBeenCalledTimes(1);

    releaseInitialize?.();
    await Promise.all([first, second]);

    expect(isAppBootstrapped()).toBe(true);
    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });
});
