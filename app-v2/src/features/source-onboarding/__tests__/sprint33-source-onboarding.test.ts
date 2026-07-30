import { describe, expect, it } from 'vitest';

import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import type { SourceRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import { EventOriginService } from '@/features/events/services/event-origin-service';
import { generateDeclarativeSourceConfig, validateDeclarativeSourceConfig } from '@/features/source-onboarding/config/config-generator';
import { runSourceOnboardingDryRun } from '@/features/source-onboarding/dry-run/source-onboarding-dry-run';
import { normalizeSubmittedSourceUrl } from '@/features/source-onboarding/security/url-normalizer';
import { InMemorySourceOnboardingRepository } from '@/features/source-onboarding/repositories/source-onboarding-repository';
import { SourceOnboardingService } from '@/features/source-onboarding/services/source-onboarding-service';

const baseSource: SourceRecord = {
  id: 'source-test',
  slug: 'test',
  displayName: 'Test',
  sourceType: 'website',
  parserType: 'json_ld',
  acquisitionStrategy: 'json_ld',
  priority: 50,
  trustScore: 80,
  requiresAuthentication: false,
  enabled: true,
  archived: false,
  reviewRequired: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const baseRecord: ImportRecord = {
  id: 'rec-1',
  sourceId: 'source-test',
  externalId: 'ext-1',
  sourceUrl: 'https://club.example/events',
  originalUrl: 'https://club.example/events/1',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00.000Z',
  retrievedAt: '2026-01-01T00:00:00.000Z',
  normalizedPayload: {
    title: 'Techno Night',
    startDate: '2026-08-01T22:00:00+02:00',
    ticketUrl: 'https://tickets.example/1',
  },
};

describe('Sprint 33 event origins', () => {
  it('upserts origin metadata idempotently without duplicate external keys', async () => {
    const repos = new InMemoryMultiSourceRepositories();
    const service = new EventOriginService(repos.sourceReferences);

    const first = await service.upsertFromPublish({
      canonicalEventId: 'evt-1',
      source: baseSource,
      record: baseRecord,
      candidate: {
        externalId: 'ext-1',
        sourceId: 'source-test',
        sourceName: 'Test',
        title: 'Techno Night',
        startDate: '2026-08-01T22:00:00+02:00',
        ticketUrl: 'https://tickets.example/1',
        eventUrl: 'https://club.example/events/1',
      },
    });

    const second = await service.upsertFromPublish({
      canonicalEventId: 'evt-1',
      source: baseSource,
      record: baseRecord,
      candidate: {
        externalId: 'ext-1',
        sourceId: 'source-test',
        sourceName: 'Test',
        title: 'Techno Night',
        startDate: '2026-08-01T22:00:00+02:00',
        ticketUrl: 'https://tickets.example/1',
        eventUrl: 'https://club.example/events/1',
      },
    });

    const origins = await service.listByEventId('evt-1');
    expect(origins).toHaveLength(1);
    expect(first.externalId).toBe(second.externalId);
    expect(origins[0]?.role).toBeDefined();
  });

  it('supports multiple ticket origins on one canonical event', async () => {
    const repos = new InMemoryMultiSourceRepositories();
    const service = new EventOriginService(repos.sourceReferences);
    const ticketSource: SourceRecord = {
      ...baseSource,
      id: 'source-ticket',
      sourceType: 'ticket_platform',
      connectorKey: 'ticket_platform',
    };

    await service.upsertFromPublish({
      canonicalEventId: 'evt-1',
      source: baseSource,
      record: baseRecord,
      candidate: {
        externalId: 'ext-official',
        sourceId: baseSource.id,
        sourceName: 'Test',
        title: 'Techno Night',
        startDate: '2026-08-01T22:00:00+02:00',
        eventUrl: 'https://club.example/events/1',
      },
      isPrimary: true,
    });

    await service.upsertFromPublish({
      canonicalEventId: 'evt-1',
      source: ticketSource,
      record: { ...baseRecord, id: 'rec-2', externalId: 'ticket-1', sourceId: ticketSource.id },
      candidate: {
        externalId: 'ticket-1',
        sourceId: ticketSource.id,
        sourceName: 'Tickets',
        title: 'Techno Night',
        startDate: '2026-08-01T22:00:00+02:00',
        ticketUrl: 'https://ticket.io/shop/event/1',
      },
      isPrimary: false,
    });

    const origins = await service.listByEventId('evt-1');
    expect(origins).toHaveLength(2);
    expect(origins.some((origin) => origin.role === 'ticketing')).toBe(true);
  });
});

describe('Sprint 33 source onboarding', () => {
  it('normalizes URLs and blocks SSRF targets', () => {
    const normalized = normalizeSubmittedSourceUrl('club.example/events');
    expect(normalized.normalized).toMatch(/^https:\/\//);
    expect(normalized.hostname).toBe('club.example');

    expect(() => normalizeSubmittedSourceUrl('http://127.0.0.1/events')).toThrow();
    expect(() => normalizeSubmittedSourceUrl('file:///etc/passwd')).toThrow();
  });

  it('generates declarative config without executable code', () => {
    const config = generateDeclarativeSourceConfig({
      listUrl: 'https://club.example/events',
      discovery: {
        steps: [{ step: 'recommended_strategy', result: 'json_ld', confidence: 0.9, evidence: 'test' }],
        warnings: [],
        detectedPlatform: 'wordpress_tribe',
        detectedSourceType: 'website',
        confidence: 0.9,
      },
    });
    const validation = validateDeclarativeSourceConfig(config);
    expect(validation.valid).toBe(true);
    expect(config.acquisition.strategy).toBe('json_ld');
    expect(JSON.stringify(config)).not.toContain('eval(');
  });

  it('runs dry-run scope filtering on sample JSON-LD', () => {
    const report = runSourceOnboardingDryRun({
      discovery: {
        steps: [],
        warnings: [],
        confidence: 0.8,
        document: {
          requestedUrl: 'https://club.example',
          finalUrl: 'https://club.example',
          statusCode: 200,
          contentType: 'text/html',
          html: `<html><script type="application/ld+json">{"@type":"MusicEvent","name":"Techno Rave","startDate":"2026-08-01T22:00:00+02:00","location":{"name":"Club"}}</script></html>`,
          responseSize: 100,
          fetchedAt: new Date().toISOString(),
          redirectChain: [],
        },
      },
    });
    expect(report.parsedEvents).toBeGreaterThan(0);
    expect(report.electronicEvents).toBeGreaterThan(0);
  });

  it('detects duplicate hostnames during discovery', async () => {
    const repository = new InMemorySourceOnboardingRepository();
    const service = new SourceOnboardingService(repository, async () => [
      { hostname: 'ra.co', sourceId: 'source-ra' },
    ]);

    const response = await service.discoverFromUrl('admin', {
      url: 'https://www.ra.co/events',
    });
    expect(response.job.status).toBe('review_required');
    expect(response.job.duplicateSourceId).toBe('source-ra');
  });
});
