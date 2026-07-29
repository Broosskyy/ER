/**
 * Loads app-v2/.env into process.env for Node ops scripts.
 * Must be imported before any Supabase client module.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = join(projectRoot, '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
