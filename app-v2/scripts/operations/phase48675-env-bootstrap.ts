import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OPS_DIR = dirname(fileURLToPath(import.meta.url));

if (!existsSync(join(OPS_DIR, '../../.env'))) {
  const fallbacks = ['C:/ER/app-v2/.env', join(OPS_DIR, '../../../../ER/app-v2/.env')];
  for (const fallbackEnv of fallbacks) {
    if (existsSync(fallbackEnv)) {
      process.env.ER_OPS_ENV_FILE = fallbackEnv;
      break;
    }
  }
}
