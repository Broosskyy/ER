/**
 * Loads app-v2/.env into process.env for Node ops scripts.
 * Must be imported before any Supabase client module.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultEnvPath = join(projectRoot, '.env');

function loadEnvFromFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      process.env[key] = value;
    }
  }
}

const explicitEnvPath = process.env.ER_OPS_ENV_FILE;
if (explicitEnvPath) {
  loadEnvFromFile(explicitEnvPath);
} else {
  loadEnvFromFile(defaultEnvPath);
}

/**
 * Ops scripts use shared datasources that call getSupabaseClient() (anon). Elevate to
 * service-role credentials for Node-only operations after .env is loaded.
 */
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}
