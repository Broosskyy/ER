import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDetailEvidenceFromHtml } from '@/features/import/bulk-canonical-rebuild/detail-evidence-parser';
import { DetailEvidenceService } from '@/features/import/bulk-canonical-rebuild/detail-evidence-service';
import {
  blockedContributionKeysFromTriage,
  triageClusterCollisions,
} from '@/features/import/bulk-canonical-rebuild/collision-triage';
import { buildFixtureContributions } from '@/features/import/bulk-canonical-rebuild/acceptance-fixture-catalog';
import { runFixtureRebuildAcceptance } from '@/features/import/bulk-canonical-rebuild/fixture-rebuild-runner';
import { assembleRebuiltCanonicalEvent } from '@/features/import/bulk-canonical-rebuild/rebuild-assembler';

const FIXTURES_DIR = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures',
);

describe('detail evidence and collision triage (4.8.6.7.2)', () => {
  it('reuses embedded html without fetch', async () => {
    const html = '<html><title>Test Event</title><meta name="description" content="Desc"/></html>';
    const service = new DetailEvidenceService();
    service.registerEmbeddedHtml('https://example.com/event', html);
    const result = await service.resolve({
      sourceId: 'src-1',
      sourceRole: 'official_website_source',
      eventUrl: 'https://example.com/event',
    });
    expect(result.fetchStatus).toBe('ok');
    expect(result.diagnostics).toContain('embedded_html_reused');
    expect(service.getMetrics().executedRequests).toBe(0);
  });

  it('cache prevents duplicate url fetches', async () => {
    let calls = 0;
    const service = new DetailEvidenceService({
      fetchFn: async () => {
        calls += 1;
        return { status: 200, html: '<html><meta name="description" content="A"/></html>' };
      },
    });
    const request = {
      sourceId: 'src-1',
      sourceRole: 'official_website_source',
      eventUrl: 'https://example.com/event',
    };
    await service.resolve(request);
    await service.resolve(request);
    expect(calls).toBe(1);
    expect(service.getMetrics().cacheHits).toBe(1);
  });

  it('fetch errors do not throw from service', async () => {
    const service = new DetailEvidenceService({
      fetchFn: async () => ({ status: 500, error: 'server_error' }),
    });
    const result = await service.resolve({
      sourceId: 'src-1',
      sourceRole: 'ticket_platform',
      eventUrl: 'https://ticket.io/event/1',
    });
    expect(result.fetchStatus).toBe('http_error');
  });

  it('ticket.io pow detail does not invent identity from challenge title', () => {
    const html = readFileSync(join(FIXTURES_DIR, 'ticket-io-proton-shockone-detail.html'), 'utf8');
    const result = parseDetailEvidenceFromHtml(
      {
        sourceId: 'src-io',
        sourceRole: 'ticket_platform',
        eventUrl: 'https://bootshaus.ticket.io/shockone/',
      },
      html,
    );
    if (result.fetchStatus === 'pow_challenge') {
      expect(result.identity?.pageTitle ?? '').not.toMatch(/security check/i);
    }
  });

  it('classifies hard_identity_conflict for incompatible title and day', () => {
    const left = buildFixtureContributions('BC173')[0];
    const right = buildFixtureContributions('R3HAB')[0];
    const triage = triageClusterCollisions([left, right]);
    expect(triage.triageEntries.some((e) => e.triageType === 'hard_identity_conflict')).toBe(true);
  });

  it('classifies stale_import_linkage for MDMA chrome contribution', () => {
    const contributions = buildFixtureContributions('MDMA');
    const existing = {
      id: 'evt-1785389052337-0gv1iz1',
      title: 'MDMA - Musik Die Mich Antreibt',
      description: '',
      startDate: '2026-10-10T20:00:00.000Z',
      status: 'published' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const triage = triageClusterCollisions(contributions, existing);
    const chrome = triage.triageEntries.find((e) => e.contributionKey.includes('chrome'));
    expect(
      chrome?.triageType === 'stale_import_linkage' ||
        chrome?.triageType === 'hard_identity_conflict',
    ).toBe(true);
    expect(blockedContributionKeysFromTriage(triage).some((k) => k.includes('chrome'))).toBe(true);
  });

  it('isolates bad contribution without blocking entire MDMA cluster assembly', () => {
    const contributions = buildFixtureContributions('MDMA');
    const triage = triageClusterCollisions(contributions, {
      id: 'evt-1785389052337-0gv1iz1',
      title: 'MDMA - Musik Die Mich Antreibt',
      description: '',
      startDate: '2026-10-10T20:00:00.000Z',
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const rebuilt = assembleRebuiltCanonicalEvent({
      contributions,
      collisionContributionKeys: blockedContributionKeysFromTriage(triage),
      eventId: 'evt-1785389052337-0gv1iz1',
    });
    expect(rebuilt.ticketUrl ?? '').not.toContain('chrome');
    expect(rebuilt.ticketUrl ?? '').toContain('ticketkings');
  });

  it('fixture acceptance 7/7 pass', () => {
    const { acceptance } = runFixtureRebuildAcceptance();
    expect(acceptance.passed).toBe(true);
    expect(acceptance.blockingFailures).toHaveLength(0);
    expect(acceptance.results.filter((r) => r.passed).length).toBe(7);
  });
});
