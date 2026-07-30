/**
 * Sprint 33.1 — controlled live source onboarding validation (Cases A/B/C).
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint331_onboarding_validation.json',
);

async function main(): Promise<void> {
  const { sourceOnboardingService } = await import('@/data/repositories/registry');
  const role = 'admin' as const;
  const results: Record<string, unknown> = { validatedAt: new Date().toISOString() };

  results.caseA_bootshaus = await sourceOnboardingService.discoverFromUrl(role, {
    url: 'https://bootshaus.tv/events/',
  });

  results.caseB_fixture = await sourceOnboardingService.discoverFromUrl(role, {
    url: 'https://affenkaefig.info/tickets/',
  });

  try {
    await sourceOnboardingService.discoverFromUrl(role, {
      url: 'http://127.0.0.1/private-events',
    });
    results.caseC_ssrf = { blocked: false };
  } catch (error) {
    results.caseC_ssrf = {
      blocked: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
