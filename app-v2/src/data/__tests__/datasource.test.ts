import { describe, expect, it } from 'vitest';

import { createLocalDatasourceBundle } from '@/data/datasources/local/local-datasource';
import { featureFlags } from '@/core/config/feature-flags';

describe('LocalDatasource', () => {
  it('returns published events from pipeline', async () => {
    const bundle = createLocalDatasourceBundle();
    const events = await bundle.events.getPublishedEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.status === 'published')).toBe(true);
  });

  it('lists admin events with search and status filter', async () => {
    const bundle = createLocalDatasourceBundle();
    const result = await bundle.events.listEvents({
      query: 'techno',
      status: 'published',
      page: 1,
      pageSize: 10,
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('provides dashboard stats', async () => {
    const bundle = createLocalDatasourceBundle();
    const stats = await bundle.stats.getDashboardStats();
    expect(stats.events).toBeGreaterThan(0);
    expect(stats.genres).toBeGreaterThan(0);
    expect(stats.cities).toBeGreaterThan(0);
  });
});

describe('featureFlags', () => {
  it('defaults to local datasource', () => {
    expect(featureFlags.useSupabase).toBe(false);
  });
});
