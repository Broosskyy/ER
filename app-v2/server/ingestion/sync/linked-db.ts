import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertStagingTarget,
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  type VerifiedStagingTarget,
} from './staging-guard';

export type LinkedQueryExecutor = (sql: string) => unknown;

export function parseLinkedQueryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }
    if (rows && typeof rows === 'object') {
      return [rows as T];
    }
  }
  return [];
}

export function parseLinkedQueryOutput(output: string): unknown {
  const parsed = JSON.parse(output.trim()) as {
    rows?: Array<Record<string, unknown>>;
  };

  if (Array.isArray(parsed.rows) && parsed.rows.length === 1) {
    const row = parsed.rows[0];
    if (row && typeof row === 'object') {
      const values = Object.values(row);
      if (values.length === 1 && values[0] && typeof values[0] === 'object') {
        return values[0];
      }
      return row;
    }
  }

  return parsed;
}

export function createSupabaseCliLinkedQueryExecutor(cwd = process.cwd()): LinkedQueryExecutor {
  return (sql: string) => {
    try {
      const out = execSync('npx supabase db query --linked --yes', {
        cwd,
        input: sql,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
      return parseLinkedQueryOutput(out);
    } catch (error) {
      const err = error as { stderr?: Buffer | string; stdout?: Buffer | string; message: string };
      const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? '';
      const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '';
      throw new Error(`${err.message}\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`);
    }
  };
}

export function verifyLinkedStagingTarget(cwd = process.cwd()): VerifiedStagingTarget {
  const projects = JSON.parse(
    execSync('npx supabase projects list', { cwd, encoding: 'utf8' }),
  ) as { projects: Array<{ ref: string; name: string; linked: boolean }> };

  const linked = projects.projects.filter((project) => project.linked);
  if (linked.length !== 1) {
    throw new Error(`linked_project_count_invalid:${linked.length}`);
  }

  const target = linked[0]!;
  return assertStagingTarget(target.ref, target.name);
}

export function loadJsonAgg<T>(runQuery: LinkedQueryExecutor, sql: string): T[] {
  return parseLinkedQueryRows<T>(runQuery(sql));
}

export function readMigrationSql(filename: string, cwd = process.cwd()): string {
  return readFileSync(join(cwd, 'supabase', 'migrations', filename), 'utf8');
}

export function migrationTablesPresent(runQuery: LinkedQueryExecutor): {
  ingestionRuns: boolean;
  ingestionSourceHealth: boolean;
} {
  const result = runQuery(`
    SELECT jsonb_build_object(
      'ingestionRuns', EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ingestion_runs'
      ),
      'ingestionSourceHealth', EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ingestion_source_health'
      )
    ) AS rows;
  `) as { ingestionRuns?: boolean; ingestionSourceHealth?: boolean };

  return {
    ingestionRuns: Boolean(result.ingestionRuns),
    ingestionSourceHealth: Boolean(result.ingestionSourceHealth),
  };
}

export function assertProductionNotLinked(cwd = process.cwd()): void {
  const projects = JSON.parse(
    execSync('npx supabase projects list', { cwd, encoding: 'utf8' }),
  ) as { projects: Array<{ ref: string; name: string; linked: boolean }> };
  const linkedProduction = projects.projects.find(
    (project) => project.linked && project.ref === PRODUCTION_PROJECT_REF,
  );
  if (linkedProduction) {
    throw new Error(`production_project_linked:${linkedProduction.ref}`);
  }
}

export function stagingGuardConstants() {
  return {
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
  };
}
