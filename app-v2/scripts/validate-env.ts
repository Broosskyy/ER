#!/usr/bin/env tsx
import { assertValidEnvironment } from '../src/core/config/validate-env';

const production = process.argv.includes('--production');

try {
  assertValidEnvironment({ production });
  console.log(`Environment validation passed (${production ? 'production' : 'development'} mode).`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
