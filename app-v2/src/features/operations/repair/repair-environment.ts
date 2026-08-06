import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
import type { SourceConnectorKey } from '@/features/aggregation/connectors/types';
import { HISTORICAL_DATA_REPAIR_VERSION } from '@/features/import/services/historical-data-repair';
import { TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION } from '@/features/import/services/ticket-platform-field-repair';
import { TICKET_IO_CONNECTOR_VERSION } from '@/features/sources/production/ticket-io-source.core';

export const CURRENT_REPAIR_VERSION = HISTORICAL_DATA_REPAIR_VERSION;

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

export function resolveRepairProjectId(supabaseUrl?: string): string {
  const url = supabaseUrl ?? process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!url) {
    return 'unknown-project';
  }
  try {
    const hostname = new URL(url).hostname;
    const [projectRef] = hostname.split('.');
    return projectRef || hostname;
  } catch {
    return 'unknown-project';
  }
}

export function resolveRepairEnvironmentLabel(supabaseUrl?: string): string {
  const projectId = resolveRepairProjectId(supabaseUrl);
  if (projectId.includes('localhost') || projectId === '127') {
    return 'local';
  }
  if (/staging|preview|dev/i.test(projectId)) {
    return 'staging';
  }
  return 'production';
}

export function resolveCurrentSchemaWatermark(): string {
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();
    return files.at(-1) ?? 'unknown-schema';
  } catch {
    return 'unknown-schema';
  }
}

export function resolveConnectorVersions(): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const [key, definition] of Object.entries(SOURCE_CONNECTOR_DEFINITIONS)) {
    versions[key as SourceConnectorKey] = definition.version.connectorVersion;
  }
  versions.ticket_io = TICKET_IO_CONNECTOR_VERSION;
  return versions;
}

export function resolveParserVersions(): Record<string, string> {
  return {
    ticket_platform_detail: TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION,
    historical_repair: HISTORICAL_DATA_REPAIR_VERSION,
  };
}

export function resolveRepairEnvironment(supabaseUrl?: string): {
  environment: string;
  projectId: string;
  schemaWatermark: string;
  repairVersion: string;
  connectorVersions: Record<string, string>;
  parserVersions: Record<string, string>;
} {
  return {
    environment: resolveRepairEnvironmentLabel(supabaseUrl),
    projectId: resolveRepairProjectId(supabaseUrl),
    schemaWatermark: resolveCurrentSchemaWatermark(),
    repairVersion: CURRENT_REPAIR_VERSION,
    connectorVersions: resolveConnectorVersions(),
    parserVersions: resolveParserVersions(),
  };
}
