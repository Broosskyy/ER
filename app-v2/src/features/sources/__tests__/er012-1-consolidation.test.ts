import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { ImportOperationsService } from '@/features/import/admin/import-operations-service';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import { SOURCE_DEFAULT_TRUST_SCORE } from '@/features/sources/domain/source-types';
import { validateSourceInput } from '@/features/sources/domain/source-validation';
import { createSourceServiceFromImportStore } from '@/features/sources/services/source-import-bridge';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260739000000_er012_1_source_foundation_consolidation.sql',
);

const ownerSession = {
  user: { id: 'owner-1', email: 'admin@eternalrave.app' },
  accessToken: 'token',
  role: 'owner' as const,
};

describe('ER-012.1 source foundation consolidation', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('aligns trust_score database default to neutral 50', () => {
    expect(sql).toContain('alter column trust_score set default 50');
  });

  it('defaults trust score to neutral 50 when omitted from input', () => {
    const validated = validateSourceInput({
      displayName: 'Neutral Source',
      sourceType: 'manual',
      parserType: 'unknown',
      acquisitionStrategy: 'manual',
      priority: 50,
    });
    expect(validated.trustScore).toBe(SOURCE_DEFAULT_TRUST_SCORE);
  });

  it('routes import saveSource through SourceService duplicate rules', async () => {
    const bundle = createLocalImportDatasourceBundle();
    const sourceService = createSourceServiceFromImportStore(bundle.store);
    const registry = new ImportAdapterRegistry();
    const logging = new ImportLoggingService(bundle.importLogs);
    const orchestrator = new ImportOrchestrator(
      bundle.importSources,
      bundle.importJobs,
      bundle.importRecords,
      registry,
      logging,
    );
    const audit = new ImportAuditService(bundle.importAuditLogs);
    const operations = new ImportOperationsService(
      bundle.importSources,
      sourceService,
      bundle.importJobs,
      bundle.importAdmin,
      orchestrator,
      registry,
      audit,
    );

    await operations.saveSource(
      ownerSession,
      {
        id: 'src-a',
        name: 'Feed A',
        type: 'rss',
        trustScore: 50,
        active: true,
        adapterKey: 'rss',
        sourceUrl: 'https://example.com/feed.xml',
        sourceConfig: { feed: { feedUrl: 'https://example.com/feed.xml' } },
      },
      true,
    );

    await expect(
      operations.saveSource(
        ownerSession,
        {
          id: 'src-b',
          name: 'Feed B',
          type: 'rss',
          trustScore: 50,
          active: true,
          adapterKey: 'rss',
          sourceUrl: 'https://example.com/feed.xml',
          sourceConfig: { feed: { feedUrl: 'https://example.com/feed.xml' } },
        },
        true,
      ),
    ).rejects.toThrow(/base URL/i);
  });
});
