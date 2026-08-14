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

vi.mock('@/data/repositories/registry', () => ({
  followService: {
    hydrate: vi.fn(async () => undefined),
  },
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

  it('bootstraps successfully in local mode with an empty repository', async () => {
    await bootstrapApp();

    expect(isAppBootstrapped()).toBe(true);
    expect(initializeSyncSpy).toHaveBeenCalledTimes(1);
    expect(initializeSpy).not.toHaveBeenCalled();
    expect(repository.getPublishedSummaries()).toEqual([]);
    expect(() => assertAppBootstrapped()).not.toThrow();
  });

  it('bootstraps successfully in supabase mode', async () => {
    featureFlagsMock.useSupabase = true;
    initializeSpy.mockResolvedValue(undefined);

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
  });

  it('retries bootstrap after a failed attempt', async () => {
    featureFlagsMock.useSupabase = true;
    initializeSpy
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce(undefined);

    await expect(bootstrapApp()).rejects.toThrow('temporary outage');
    resetAppBootstrap();

    await bootstrapApp();

    expect(isAppBootstrapped()).toBe(true);
    expect(initializeSpy).toHaveBeenCalledTimes(2);
  });
});
