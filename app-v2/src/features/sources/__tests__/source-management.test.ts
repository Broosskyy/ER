import { describe, expect, it, beforeEach } from 'vitest';

import type { SourceListParams, SourceRecord } from '@/data/types/records';
import { createDefaultSourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { PARTNER_V1_API_FIXTURE } from '@/features/sources/production/partner-v1-fixture';
import { createEternalRavePartnerV1SourceRecord } from '@/features/sources/production/eternal-rave-partner-v1-source';
import {
  InMemorySourceImportHistoryStore,
} from '@/features/sources/domain/source-import-history';
import {
  validateSourceRecord,
  resolveRecordCategory,
  resolveRecordConnectorKey,
} from '@/features/sources/domain/source-management-validation';
import { isSourceCategory } from '@/features/sources/domain/source-categories';
import { isSourceManagementStatus } from '@/features/sources/domain/source-status';
import { SourceService } from '@/features/sources/services/source-service';
import { SourceManagementService } from '@/features/sources/services/source-management-service';

const adminRole = 'admin' as const;

function baseSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'src-1',
    slug: 'test-source',
    displayName: 'Test Source',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 50,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createRepository(initial: SourceRecord[] = []) {
  const items = [...initial];
  return {
    list: async (_params: SourceListParams) => ({ items, total: items.length, page: 1, pageSize: 50 }),
    getById: async (id: string) => items.find((item) => item.id === id) ?? null,
    getBySlug: async (slug: string) => items.find((item) => item.slug === slug) ?? null,
    getAll: async () => [...items],
    save: async (record: SourceRecord) => {
      const index = items.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        items[index] = record;
      } else {
        items.push(record);
      }
      return record;
    },
    archive: async (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const current = items[index]!;
      const archived = { ...current, archived: true, enabled: false };
      items[index] = archived;
      return archived;
    },
    restore: async (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const current = items[index]!;
      const restored = { ...current, archived: false };
      items[index] = restored;
      return restored;
    },
    countImportJobsForSource: async () => 0,
  };
}

describe('source management status and categories', () => {
  it('defines management statuses and categories', () => {
    expect(isSourceManagementStatus('active')).toBe(true);
    expect(isSourceManagementStatus('invalid')).toBe(false);
    expect(isSourceCategory('partner_feed')).toBe(true);
    expect(isSourceCategory('bootshaus')).toBe(false);
  });
});

describe('source management validation', () => {
  it('validates required fields and connector registration', () => {
    const valid = validateSourceRecord({
      displayName: 'Partner Feed',
      sourceType: 'api',
      parserType: 'api',
      acquisitionStrategy: 'manual',
      priority: 50,
      connectorKey: 'open_data_api',
      sourceConfig: {
        api: { fieldMapping: { title: 'name' } },
        reference: { apiJson: PARTNER_V1_API_FIXTURE },
      },
    });
    expect(valid.valid).toBe(true);

    const invalid = validateSourceRecord({
      displayName: '',
      sourceType: 'api',
      parserType: 'api',
      acquisitionStrategy: 'manual',
      priority: 50,
      connectorKey: 'unknown_connector',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.some((issue) => issue.code === 'invalid_connector')).toBe(true);
  });

  it('rejects invalid URLs without fetching', () => {
    const result = validateSourceRecord({
      displayName: 'Bad URL Source',
      sourceType: 'website',
      parserType: 'html',
      acquisitionStrategy: 'manual',
      priority: 50,
      baseUrl: 'not-a-url',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'invalid_url')).toBe(true);
  });
});

describe('SourceManagementService', () => {
  let management: SourceManagementService;
  let historyStore: InMemorySourceImportHistoryStore;

  beforeEach(() => {
    historyStore = new InMemorySourceImportHistoryStore();
    const repository = createRepository();
    const sourceService = new SourceService(repository);
    management = new SourceManagementService(
      sourceService,
      createDefaultSourceConnectorRegistry(),
      historyStore,
    );
  });

  it('creates, lists, gets, updates, disables, and archives sources', async () => {
    const created = await management.createSource(adminRole, {
      displayName: 'Rheinland Nights',
      sourceType: 'api',
      parserType: 'api',
      acquisitionStrategy: 'manual',
      priority: 80,
      category: 'partner_feed',
      connectorKey: 'open_data_api',
      countryCode: 'DE',
      city: 'Köln',
      sourceConfig: {
        api: { fieldMapping: { title: 'name', startDate: 'starts_at' } },
        reference: { apiJson: PARTNER_V1_API_FIXTURE },
      },
    });

    expect(created.category).toBe('partner_feed');
    expect(resolveRecordConnectorKey(created)).toBe('open_data_api');

    const list = await management.listSources(adminRole, { category: 'partner_feed' });
    expect(list.items).toHaveLength(1);

    const detail = await management.getSource(adminRole, created.id);
    expect(detail?.city).toBe('Köln');
    expect(detail?.connectorKey).toBe('open_data_api');

    const updated = await management.updateSource(adminRole, {
      id: created.id,
      displayName: 'Rheinland Nights V1',
      sourceType: 'api',
      parserType: 'api',
      acquisitionStrategy: 'manual',
      priority: 85,
      genreNames: ['Techno'],
      tags: ['partner'],
    });
    expect(updated.displayName).toBe('Rheinland Nights V1');
    expect(updated.genreNames).toEqual(['Techno']);

    const disabled = await management.disableSource(adminRole, created.id);
    expect(disabled.enabled).toBe(false);
    expect(disabled.status).toBe('disabled');

    const archived = await management.archiveSource(adminRole, created.id);
    expect(archived.archived).toBe(true);
    expect(archived.status).toBe('archived');
  });

  it('runs fixture-based test import and records import history', async () => {
    const partner = createEternalRavePartnerV1SourceRecord();
    const repository = createRepository([partner]);
    const sourceService = new SourceService(repository);
    management = new SourceManagementService(
      sourceService,
      createDefaultSourceConnectorRegistry(),
      historyStore,
    );

    const result = await management.runTestImport(adminRole, partner.id);
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.previewEvents.length).toBeGreaterThan(0);
    expect(result.diagnostics.connectorVersion).toBeTruthy();

    const history = management.getImportHistory(partner.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.testImport).toBe(true);
    expect(history[0]?.eventCount).toBe(result.eventCount);
  });

  it('exposes connector health and metrics from existing framework', async () => {
    const partner = createEternalRavePartnerV1SourceRecord();
    const repository = createRepository([partner]);
    const sourceService = new SourceService(repository);
    management = new SourceManagementService(
      sourceService,
      createDefaultSourceConnectorRegistry(),
      historyStore,
    );

    await management.runTestImport(adminRole, partner.id);
    const detail = await management.getSource(adminRole, partner.id);

    expect(detail?.connectorHealth?.status).toBeTruthy();
    expect(detail?.connectorMetrics?.totalRuns).toBeGreaterThan(0);
    expect(detail?.importHistory).toHaveLength(1);
  });

  it('builds admin editor model with validation state', async () => {
    const created = await management.createSource(adminRole, {
      displayName: 'Manual Source',
      sourceType: 'manual',
      parserType: 'unknown',
      acquisitionStrategy: 'manual',
      priority: 50,
      sourceConfig: {
        reference: {
          events: [{
            externalId: 'manual-1',
            importId: 'manual-1',
            title: 'Manual Event',
            startDate: '2026-09-01T20:00:00.000Z',
            rawSourceType: 'unknown',
          }],
        },
      },
    });

    const model = management.buildEditorModel(created);
    expect(model.category).toBe(resolveRecordCategory(created));
    expect(model.validation.valid).toBe(true);
    expect(model.canTestImport).toBe(true);
  });
});
