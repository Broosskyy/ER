import { describe, expect, it, vi } from 'vitest';

import { DetailEvidenceService } from '@/features/import/bulk-canonical-rebuild/detail-evidence-service';
import { runFixtureRebuildAcceptance } from '@/features/import/bulk-canonical-rebuild/fixture-rebuild-runner';
import {
  blockedContributionKeysFromTriage,
  triageClusterCollisions,
} from '@/features/import/bulk-canonical-rebuild/collision-triage';
import { buildFixtureContributions } from '@/features/import/bulk-canonical-rebuild/acceptance-fixture-catalog';
import { assembleRebuiltCanonicalEvent } from '@/features/import/bulk-canonical-rebuild/rebuild-assembler';
import { parseDetailEvidenceFromHtml } from '@/features/import/bulk-canonical-rebuild/detail-evidence-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures',
);

describe('live detail fetch wiring (4.8.6.7.3)', () => {
  it('calls fetch when embedded html is missing', async () => {
    const fetchFn = vi.fn(async () => ({
      status: 200,
      html: '<html><meta name="description" content="Live desc"/></html>',
    }));
    const service = new DetailEvidenceService({ fetchFn });
    await service.resolve(
      {
        sourceId: 'src-1',
        sourceRole: 'official_website_source',
        eventUrl: 'https://example.com/event',
      },
      { allowHttp: true },
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(service.getMetrics().executedRequests).toBe(1);
  });

  it('embedded html prevents http fetch', async () => {
    const fetchFn = vi.fn();
    const service = new DetailEvidenceService({ fetchFn });
    service.registerEmbeddedHtml('https://example.com/event', '<html>embedded</html>');
    await service.resolve(
      {
        sourceId: 'src-1',
        sourceRole: 'official_website_source',
        eventUrl: 'https://example.com/event',
      },
      { allowHttp: true },
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(service.getMetrics().embeddedHtmlHits).toBe(1);
  });

  it('deduplicates normalized urls within one service', async () => {
    let calls = 0;
    const service = new DetailEvidenceService({
      fetchFn: async () => {
        calls += 1;
        return { status: 200, html: '<html>ok</html>' };
      },
    });
    const request = {
      sourceId: 'src-1',
      sourceRole: 'official_website_source',
      eventUrl: 'https://example.com/event/',
    };
    await service.resolve(request, { allowHttp: true });
    await service.resolve(request, { allowHttp: true });
    expect(calls).toBe(1);
    expect(service.getMetrics().cacheHits).toBeGreaterThan(0);
  });

  it('retries once on 5xx', async () => {
    let calls = 0;
    const service = new DetailEvidenceService({
      fetchFn: async () => {
        calls += 1;
        if (calls === 1) return { status: 503, error: 'server_error' };
        return { status: 200, html: '<html>retry</html>' };
      },
    });
    await service.resolve(
      {
        sourceId: 'src-1',
        sourceRole: 'official_website_source',
        eventUrl: 'https://example.com/retry',
      },
      { allowHttp: true },
    );
    expect(calls).toBe(2);
    expect(service.getMetrics().httpRetries).toBe(1);
  });

  it('pow page does not invent identity title', () => {
    const html = readFileSync(join(FIXTURES_DIR, 'ticket-io-proton-shockone-detail.html'), 'utf8');
    const result = parseDetailEvidenceFromHtml(
      {
        sourceId: 'src-io',
        sourceRole: 'ticket_platform',
        eventUrl: 'https://bootshaus.ticket.io/test/',
      },
      html,
    );
    if (result.fetchStatus === 'pow_challenge') {
      expect(result.identity?.pageTitle ?? '').not.toMatch(/security check/i);
    }
  });

  it('isolates chrome without poisoning mdma ticket assembly', () => {
    const contributions = buildFixtureContributions('MDMA');
    const triage = triageClusterCollisions(contributions, {
      id: 'evt-1785389052337-0gv1iz1',
      title: 'MDMA - Musik Die Mich Antreibt',
      description: '',
      startDate: '2026-10-10T20:00:00.000Z',
      status: 'published',
      createdAt: '',
      updatedAt: '',
    });
    const rebuilt = assembleRebuiltCanonicalEvent({
      contributions,
      collisionContributionKeys: blockedContributionKeysFromTriage(triage),
      eventId: 'evt-1785389052337-0gv1iz1',
    });
    expect(rebuilt.ticketUrl ?? '').toContain('ticketkings');
    expect(rebuilt.ticketUrl ?? '').not.toContain('chrome');
  });

  it('defers http fetch when allowHttp is false', async () => {
    let calls = 0;
    const service = new DetailEvidenceService({
      fetchFn: async () => {
        calls += 1;
        return { status: 200, html: '<html><meta name="description" content="Later"/></html>' };
      },
    });
    const request = {
      sourceId: 'src-1',
      sourceRole: 'official_website_source',
      eventUrl: 'https://example.com/deferred',
    };
    const blocked = await service.resolve(request, { allowHttp: false });
    expect(blocked.fetchStatus).toBe('content_unusable');
    expect(calls).toBe(0);
    const fetched = await service.resolve(request, { allowHttp: true });
    expect(fetched.fetchStatus).toBe('ok');
    expect(calls).toBe(1);
  });

  it('fixture acceptance remains 7/7', () => {
    const { acceptance } = runFixtureRebuildAcceptance();
    expect(acceptance.passed).toBe(true);
  });
});
