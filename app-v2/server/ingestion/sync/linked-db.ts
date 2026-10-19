import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  assertStagingTarget,
  getConfiguredProductionProjectRef,
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

/**
 * Always request machine-readable Supabase CLI output. Plain GitHub Actions
 * runners don't identify as AI agents, and CLI query JSON output in several
 * recent CLI releases was empty in the default no-agent path.
 */
export function createSupabaseCliLinkedQueryExecutor(cwd = process.cwd()): LinkedQueryExecutor {
  return (sql: string) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'eternal-rave-sql-'));
    const sqlFile = join(tempDir, 'query.sql');
    try {
      writeFileSync(sqlFile, sql, { encoding: 'utf8', mode: 0o600 });
      const out = execSync(
        `npx supabase db query --linked --output-format json --agent yes -f ${sqlFile}`,
        {
          cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 * 1024,
        },
      );
      if (!out.trim()) throw new Error('supabase_db_query_returned_empty_json');
      return parseLinkedQueryOutput(out);
    } catch (error) {
      const err = error as { stderr?: Buffer | string; stdout?: Buffer | string; message: string };
      const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? '';
      const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '';
      // SQL often contains user-provided event details; never expose the full
      // command input as an Actions log or retain it beyond this invocation.
      throw new Error(`supabase_linked_query_failed:${err.message.split('\\n')[0]}\\nSTDERR:\\n${stderr.slice(0,2000)}\\nSTDOUT:\\n${stdout.slice(0,600)}`);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

/** Supports JSON array or JSON-envelope outputs across CLI versions. */
export function parseSupabaseProjectsList(output: string): Array<{ ref: string; name: string; linked?: boolean }> {
  const result: unknown = JSON.parse(output.trim());
  const candidate = Array.isArray(result) ? result :
    result && typeof result === 'object' && 'projects' in result
      ? (result as { projects: unknown }).projects
      : result && typeof result === 'object' && 'data' in result
        ? (result as { data: unknown }).data
        : null;
  if (!Array.isArray(candidate)) throw new Error('supabase_projects_invalid_json_shape');
  return candidate.map((entry) => {
    const row = entry as Record<string, unknown>;
    const ref = row.ref ?? row.id ?? row['REFERENCE ID'];
    return {
      ref: typeof ref === 'string' ? ref : '',
      name: typeof row.name === 'string' ? row.name :
        typeof row.NAME === 'string' ? row.NAME : '',
      linked: row.linked === true || row.LINKED === true,
    };
  });
}

/** The linked project-ref file is the source of truth; never guess the target. */
export function readSupabaseLinkedProjectRef(cwd = process.cwd()): string {
  const ref = readFileSync(join(cwd, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('supabase_linked_ref_invalid');
  return ref;
}

function fetchSupabaseProjects(cwd: string) {
  const output = execSync('npx supabase projects list --output-format json --agent yes', {
    cwd, encoding:'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  return parseSupabaseProjectsList(output);
}

export function verifyLinkedStagingTarget(cwd = process.cwd()): VerifiedStagingTarget {
  const ref = readSupabaseLinkedProjectRef(cwd);
  if (ref !== STAGING_PROJECT_REF) throw new Error(`non_staging_project_linked:${ref}`);
  const project = fetchSupabaseProjects(cwd).find(item => item.ref === ref);
  if (!project) throw new Error('linked_project_not_visible_in_account');
  return assertStagingTarget(ref, project.name);
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
  const ref = readSupabaseLinkedProjectRef(cwd);
  if (ref !== STAGING_PROJECT_REF) throw new Error(`non_staging_project_linked:${ref}`);
}

export function stagingGuardConstants() {
  return {
    staging: STAGING_PROJECT_REF,
    production: getConfiguredProductionProjectRef() ?? null,
  };
}
