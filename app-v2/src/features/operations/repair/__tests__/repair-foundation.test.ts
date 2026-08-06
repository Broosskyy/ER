import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import type { RepairPlan } from '@/features/operations/repair/repair-plan.types';
import {
  finalizeRepairPlan,
  fingerprintRepairRecord,
  validateRepairPlanChecksum,
} from '@/features/operations/repair/repair-plan';
import {
  RepairPlanArtifactExistsError,
  writeRepairPlanArtifact,
} from '@/features/operations/repair/repair-plan-artifact';
import {
  buildRepairPlanFromDataset,
  buildRepairPreflightResult,
} from '@/features/operations/repair/repair-plan-builder';
import { validateRepairPlanArtifact } from '@/features/operations/repair/repair-plan-validator';
import {
  classifyRepairFieldSafety,
  REPAIR_CANONICAL_FIELD_SAFETY_MATRIX,
} from '@/features/operations/repair/repair-safety-matrix';
import {
  assertLegacyRepairScriptAllowed,
  LEGACY_MUTATING_REPAIR_SCRIPTS,
} from '@/features/operations/repair/legacy-repair-script-guard';
import type { RepairAuditDataset } from '@/features/operations/repair/repair-plan.types';

function createDataset(overrides: Partial<RepairAuditDataset> = {}): RepairAuditDataset {
  return {
    generatedAt: '2026-08-01T10:00:00.000Z',
    publishedEvents: [
      {
        id: 'event-1',
        title: 'SHOCKONE at Mallorca',
        description: 'n/a',
        sourceId: 'source-bootshaus-koeln',
        venueId: 'venue-bootshaus-koeln',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        ticketUrl: 'https://ticket.io/example',
        startDate: '2026-09-01T20:00:00.000Z',
        updatedAt: '2026-08-01T09:00:00.000Z',
      },
    ],
    staleEvents: [
      {
        id: 'event-1',
        title: 'SHOCKONE at Mallorca',
        sourceId: 'source-bootshaus-koeln',
        reasons: ['wrong_bootshaus_external_venue', 'recoverable_description_in_import_record'],
        venueId: 'venue-bootshaus-koeln',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        lineupCount: 0,
        titleArtists: ['SHOCKONE'],
        externalLocationTitle: true,
        importRecordId: 'import-1',
        importRecordUpdatedAt: '2026-08-01T08:30:00.000Z',
      },
    ],
    parityIssues: [],
    importRecordsByEventId: new Map([
      [
        'event-1',
        {
          id: 'import-1',
          eventId: 'event-1',
          sourceId: 'source-bootshaus-koeln',
          updatedAt: '2026-08-01T08:30:00.000Z',
          normalizedPayload: {
            externalId: 'ext-1',
            title: 'SHOCKONE at Mallorca',
            startDate: '2026-09-01T20:00:00.000Z',
            venueName: 'Mallorca Open Air',
            cityName: 'Palma',
            description: 'Recovered description',
            sourceMetadata: { externalLocationFromTitle: true },
          },
        },
      ],
    ]),
    provenanceByEventId: new Map(),
    activeImportJobs: [],
    sourceIds: ['source-bootshaus-koeln'],
    ...overrides,
  };
}

function basePlanDraft(dataset: RepairAuditDataset): RepairPlan {
  const plan = buildRepairPlanFromDataset(dataset, 'https://example.supabase.co', 'abc123');
  if (!plan) {
    throw new Error('Expected repair plan');
  }
  return plan;
}

describe('repair safety matrix', () => {
  it('covers every modeled canonical repair field', () => {
    expect(REPAIR_CANONICAL_FIELD_SAFETY_MATRIX.length).toBeGreaterThanOrEqual(20);
    expect(REPAIR_CANONICAL_FIELD_SAFETY_MATRIX.map((rule) => rule.field)).toContain('ticketUrl');
  });

  it('blocks manual locks and missing provenance', () => {
    expect(
      classifyRepairFieldSafety({
        field: 'title',
        provenance: {
          fieldPath: 'title',
          selectedSourceId: 'manual_override',
          selectionReason: 'manual_override',
          manuallyOverridden: true,
        },
      }),
    ).toBe('blocked_manual_lock');

    expect(classifyRepairFieldSafety({ field: 'title' })).toBe('blocked_missing_provenance');
    expect(classifyRepairFieldSafety({ field: 'cache' })).toBe('safe_read_only_plan');
  });
});

describe('repair plan checksums', () => {
  it('is deterministic for identical input', () => {
    const dataset = createDataset();
    const left = basePlanDraft(dataset);
    const right = basePlanDraft(dataset);
    expect(left.changeChecksum).toBe(right.changeChecksum);
    expect(left.checksum).toBe(right.checksum);
    expect(validateRepairPlanChecksum(left)).toBe(true);
  });

  it('rejects tampered checksums', () => {
    const plan = basePlanDraft(createDataset());
    const tampered = { ...plan, checksum: 'deadbeef' };
    expect(validateRepairPlanChecksum(tampered)).toBe(false);
  });
});

describe('repair plan artifacts', () => {
  it('cannot overwrite an existing artifact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'repair-plan-'));
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const plan = basePlanDraft(createDataset());
      writeRepairPlanArtifact(plan);
      expect(() => writeRepairPlanArtifact(plan)).toThrow(RepairPlanArtifactExistsError);
    } finally {
      process.chdir(previousCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('repair plan validation', () => {
  it('rejects stale environment and checksum issues', async () => {
    const plan = basePlanDraft(createDataset());
    const wrongEnvironment = { ...plan, environment: 'staging' };
    const result = await validateRepairPlanArtifact(wrongEnvironment, {
      supabaseUrl: 'https://example.supabase.co',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'environment_mismatch')).toBe(true);
  });

  it('rejects active import jobs and blocked safety states', async () => {
    const dataset = createDataset({
      activeImportJobs: [{ id: 'job-1', sourceId: 'source-bootshaus-koeln', status: 'running' }],
    });
    const preflight = buildRepairPreflightResult(dataset, 'plan', 'https://example.supabase.co');
    expect(preflight.ok).toBe(false);

    const plan = basePlanDraft(dataset);
    const blockedPlan = {
      ...plan,
      changes: plan.changes.map((change) => ({
        ...change,
        safety: 'blocked_manual_lock' as const,
      })),
    };
    const result = await validateRepairPlanArtifact(blockedPlan, {
      supabaseUrl: 'https://example.supabase.co',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'manual_lock_blocked')).toBe(true);
  });
});

describe('repair plan builder', () => {
  it('builds typed changes from audit reasons and detectChanges semantics', () => {
    const plan = basePlanDraft(createDataset());
    expect(plan.summary.totalChanges).toBeGreaterThan(0);
    expect(plan.changes.some((change) => change.fieldOrRelationship === 'venueName')).toBe(true);
    expect(plan.changes.some((change) => change.fieldOrRelationship === 'description')).toBe(true);
    expect(plan.recordSnapshots).toHaveLength(1);
    expect(plan.recordSnapshots[0]?.fingerprint).toBe(
      fingerprintRepairRecord({
        event: plan.recordSnapshots[0] && createDataset().publishedEvents[0],
        importRecordUpdatedAt: '2026-08-01T08:30:00.000Z',
      }),
    );
  });
});

describe('legacy repair script guard', () => {
  it('blocks legacy scripts without acknowledgement', () => {
    expect(() =>
      assertLegacyRepairScriptAllowed('scripts/operations/_sprint36-republish-queued.ts', []),
    ).toThrow(/Blocked legacy repair script/);
  });

  it('documents all inventoried legacy scripts', () => {
    expect(LEGACY_MUTATING_REPAIR_SCRIPTS.length).toBe(7);
  });
});

describe('repair-events cli structural safety', () => {
  it('rejects apply flags before bootstrap import', async () => {
    const { execFileSync } = await import('node:child_process');
    expect(() =>
      execFileSync(
        'npx',
        ['tsx', 'scripts/operations/repair-events.ts', '--apply'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
        },
      ),
    ).toThrow();
  });
});
