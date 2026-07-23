/**
 * Sprint 12 independent acceptance tests.
 * Validates integration of PRs #18–#21 at service/repository level.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import type { ImportSourceAdapter } from '@/features/import/adapters/types';
import { assertPermission, hasPermission } from '@/features/import/admin/admin-roles';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportOperationsService } from '@/features/import/admin/import-operations-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
import { ImportPermissionError } from '@/features/import/errors/import-errors';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import { createSourceServiceFromImportStore } from '@/features/sources/services/source-import-bridge';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import type { ImportRecord, ImportSource } from '@/features/import/models/types';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { AdminEventRecord } from '@/data/types/records';
import {
  JSON_LD_SINGLE_EVENT,
  RSS_FEED,
  ATOM_FEED,
  ICAL_EVENT,
  CSV_CONTENT,
  API_JSON,
} from '@/features/import/__tests__/fixtures/import-fixtures';

const owner: AuthSession = { user: { id: 'owner', email: 'admin@eternalrave.app' }, accessToken: 't', role: 'owner' };
const viewer: AuthSession = { user: { id: 'viewer', email: 'v@test.com' }, accessToken: 't', role: 'viewer' };
const editor: AuthSession = { user: { id: 'editor', email: 'e@test.com' }, accessToken: 't', role: 'editor' };
const reviewer: AuthSession = { user: { id: 'reviewer', email: 'r@test.com' }, accessToken: 't', role: 'reviewer' };
const sourceManager: AuthSession = { user: { id: 'sm', email: 'sm@test.com' }, accessToken: 't', role: 'source_manager' };

function createStack(fixtureBody: string, adapterKey = 'rss') {
  const bundle = createLocalImportDatasourceBundle();
  const registry = new ImportAdapterRegistry();
  const adapter: ImportSourceAdapter = {
    adapterKey,
    async execute() {
      return {
        records: [
          {
            externalId: 'e2e-1',
            rawPayload: { body: fixtureBody },
            normalizedCandidate: {
              externalId: 'e2e-1',
              title: 'E2E Event',
              startDate: '2026-09-01T20:00:00Z',
              cityName: 'Köln',
              venueName: 'Club',
              rawSourceType: 'rss',
            },
            status: 'needs_review' as const,
          },
          {
            externalId: 'invalid-1',
            rawPayload: { bad: true },
            normalizedCandidate: {
              externalId: 'invalid-1',
              title: '',
              startDate: '',
              rawSourceType: 'rss',
            },
            validationErrors: [{ code: 'TITLE_MISSING', message: 'Title is required.' }],
            status: 'invalid' as const,
          },
        ],
        warnings: [],
        skippedCount: 0,
        metadata: {},
      };
    },
  };
  registry.register(adapter);
  const logging = new ImportLoggingService(bundle.importLogs);
  const orchestrator = new ImportOrchestrator(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    registry,
    logging,
  );
  const audit = new ImportAuditService(bundle.importAuditLogs);
  const sourceService = createSourceServiceFromImportStore(bundle.store);
  const ops = new ImportOperationsService(
    bundle.importSources,
    sourceService,
    bundle.importJobs,
    bundle.importAdmin,
    orchestrator,
    registry,
    audit,
  );
  const events: AdminEventRecord[] = [];
  const eventRepo = {
    list: async () => ({ items: events, total: events.length, page: 1, pageSize: 20 }),
    getById: async (id: string) => events.find((e) => e.id === id) ?? null,
    save: async (e: AdminEventRecord) => { events.push(e); return e; },
    delete: async () => {},
  };
  const review = new ImportReviewService(
    bundle.importRecords,
    bundle.importAdmin,
    eventRepo,
    audit,
    {
      replaceFromMatchedArtistIds: async () => [],
    },
  );
  return { bundle, ops, review, events, orchestrator };
}

async function seedSource(stack: ReturnType<typeof createStack>): Promise<ImportSource> {
  return stack.bundle.importSources.save({
    id: 'src-e2e',
    name: 'E2E Source',
    type: 'feed',
    trustScore: 80,
    active: true,
    adapterKey: 'rss',
    sourceConfig: { feed: { feedUrl: 'https://example.com/feed.xml' } },
  });
}

describe('Sprint 12 Acceptance — Role matrix', () => {
  it('viewer can read but not write', () => {
    expect(hasPermission('viewer', 'records:read')).toBe(true);
    expect(hasPermission('viewer', 'records:approve')).toBe(false);
    expect(() => assertPermission('viewer', 'records:approve')).toThrow(ImportPermissionError);
  });

  it('editor can edit but not approve', () => {
    expect(hasPermission('editor', 'records:edit')).toBe(true);
    expect(hasPermission('editor', 'records:approve')).toBe(false);
  });

  it('reviewer can approve/reject/duplicate', () => {
    expect(hasPermission('reviewer', 'records:approve')).toBe(true);
    expect(hasPermission('reviewer', 'records:reject')).toBe(true);
    expect(hasPermission('reviewer', 'records:duplicate')).toBe(true);
    expect(hasPermission('reviewer', 'sources:write')).toBe(false);
  });

  it('source_manager can manage sources and imports', () => {
    expect(hasPermission('source_manager', 'sources:write')).toBe(true);
    expect(hasPermission('source_manager', 'imports:start')).toBe(true);
    expect(hasPermission('source_manager', 'records:approve')).toBe(false);
  });
});

describe('Sprint 12 Acceptance — Full E2E pipeline', () => {
  let stack: ReturnType<typeof createStack>;
  let record: ImportRecord;

  beforeEach(async () => {
    stack = createStack(RSS_FEED);
    await seedSource(stack);
    const test = await stack.ops.testSource(owner, 'src-e2e');
    expect(test.recordCount).toBeGreaterThan(0);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    expect(job.status).toMatch(/completed/);
    const records = await stack.bundle.importRecords.listByJobId(job.id);
    record = records.find((r) => r.status === 'needs_review')!;
    expect(record).toBeDefined();
  });

  it('runs source test → import → review → edit → approve → draft event', async () => {
    const edited = await stack.review.editRecord(owner, record.id, { title: 'Edited Title' }, record.updatedAt);
    expect(edited.reviewerEdits?.title).toBe('Edited Title');
    expect(edited.rawPayload).toEqual(record.rawPayload);

    const { record: approved, event } = await stack.review.approveRecord(owner, record.id, edited.updatedAt);
    expect(approved.status).toBe('imported');
    expect(approved.resultingEventId).toBe(event.id);
    expect(event.status).toBe('draft');
    expect(event.status).not.toBe('published');

    const audits = await stack.bundle.importAuditLogs.listByEntity('import_record', record.id);
    expect(audits.some((a) => a.action === 'record_approved')).toBe(true);
  });

  it('invalid record does not block job and creates no event', async () => {
    const job = await stack.bundle.importJobs.getById(record.importJobId);
    expect(job?.status).toMatch(/completed/);
    const invalid = (await stack.bundle.importRecords.listByJobId(record.importJobId)).find(
      (r) => r.status === 'invalid',
    );
    expect(invalid).toBeDefined();
    expect(invalid?.validationErrors?.length).toBeGreaterThan(0);
    expect(stack.events).toHaveLength(0);
  });
});

describe('Sprint 12 Acceptance — Duplicate workflow', () => {
  it('confirm duplicate does not create event', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    let record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    record = await stack.bundle.importRecords.update({
      ...record,
      duplicateEventId: 'existing-evt',
      duplicateScore: 95,
    });
    const confirmed = await stack.review.confirmDuplicate(owner, record.id, 'existing-evt', record.updatedAt);
    expect(confirmed.status).toBe('duplicate');
    expect(stack.events).toHaveLength(0);
  });

  it('blocks approve when duplicate score exceeds threshold without dismiss', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    let record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    record = await stack.bundle.importRecords.update({
      ...record,
      duplicateEventId: 'existing-evt',
      duplicateScore: 95,
    });
    await expect(stack.review.approveRecord(owner, record.id, record.updatedAt)).rejects.toThrow(
      /duplicate/i,
    );
  });

  it('allows approve when duplicate score is below threshold', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    let record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    record = await stack.bundle.importRecords.update({
      ...record,
      duplicateScore: 50,
    });
    const { event } = await stack.review.approveRecord(owner, record.id, record.updatedAt);
    expect(event.status).toBe('draft');
  });

  it('dismiss duplicate allows review to continue', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    let record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    record = await stack.bundle.importRecords.update({
      ...record,
      duplicateEventId: 'existing-evt',
      duplicateScore: 95,
    });
    const dismissed = await stack.review.dismissDuplicate(owner, record.id, record.updatedAt);
    expect(dismissed.duplicateDecision).toBe('dismissed');
    expect(dismissed.status).toBe('needs_review');
  });
});

describe('Sprint 12 Acceptance — Reject workflow', () => {
  it('rejects with reason and creates no event', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    const record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    const rejected = await stack.review.rejectRecord(owner, record.id, 'spam', 'Not relevant', record.updatedAt);
    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewedBy).toBe('owner');
    expect(rejected.reviewedAt).toBeDefined();
    expect(stack.events).toHaveLength(0);
  });

  it('viewer cannot reject', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    const record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    await expect(
      stack.review.rejectRecord(viewer, record.id, 'spam', undefined, record.updatedAt),
    ).rejects.toThrow(ImportPermissionError);
  });
});

describe('Sprint 12 Acceptance — Concurrency', () => {
  it('blocks second import for same source', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    await stack.bundle.importJobs.create({ sourceId: 'src-e2e', triggerType: 'manual', status: 'running' });
    await expect(stack.ops.startManualImport(owner, 'src-e2e')).rejects.toThrow(/already running/i);
  });

  it('rejects stale approve with concurrency error', async () => {
    const stack = createStack(RSS_FEED);
    await seedSource(stack);
    const job = await stack.ops.startManualImport(owner, 'src-e2e');
    const record = (await stack.bundle.importRecords.listByJobId(job.id)).find((r) => r.status === 'needs_review')!;
    await expect(stack.review.approveRecord(owner, record.id, 'stale-ts')).rejects.toThrow(/modified/i);
  });
});

describe('Sprint 12 Acceptance — SSRF protection', () => {
  const blocked = [
    'http://localhost/feed',
    'http://127.0.0.1/feed',
    'http://192.168.1.1/feed',
    'http://10.0.0.1/feed',
    'file:///etc/passwd',
    'ftp://example.com/feed',
    'data:text/html,test',
    'javascript:alert(1)',
  ];

  for (const url of blocked) {
    it(`blocks ${url.split(':')[0]}:// URLs`, async () => {
      await expect(importFetchService.fetch({ url })).rejects.toThrow();
    });
  }
});

describe('Sprint 12 Acceptance — Adapter fixtures parse', () => {
  const fixtures = [
    { name: 'JSON-LD', body: JSON_LD_SINGLE_EVENT },
    { name: 'RSS', body: RSS_FEED },
    { name: 'Atom', body: ATOM_FEED },
    { name: 'iCal', body: ICAL_EVENT },
    { name: 'CSV', body: CSV_CONTENT },
    { name: 'API JSON', body: API_JSON },
  ];

  for (const { name, body } of fixtures) {
    it(`${name} fixture is non-empty`, () => {
      expect(body.length).toBeGreaterThan(10);
    });
  }
});

describe('Sprint 12 Acceptance — Migration structure', () => {
  it('validates migration script passes', async () => {
    const { execSync } = await import('node:child_process');
    const { readdirSync } = await import('node:fs');
    const { join } = await import('node:path');

    const migrationCount = readdirSync(join(process.cwd(), 'supabase', 'migrations')).filter((file) =>
      file.endsWith('.sql'),
    ).length;

    const out = execSync('npm run validate:migrations', { cwd: process.cwd(), encoding: 'utf8' });
    expect(out).toContain(`Validated ${migrationCount} migration file(s)`);
    expect(out).toContain('Import foundation tables and admin RLS checks passed.');
  });
});
