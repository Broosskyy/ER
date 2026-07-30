/**
 * Sprint 33.2 — read-only production validation (origins, onboarding jobs, integrity).
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint332_production_validation.json',
);

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();
  const report: Record<string, unknown> = { validatedAt: new Date().toISOString() };

  const { count: canonicalEvents } = await client
    .from('events')
    .select('*', { count: 'exact', head: true });
  const { count: publishedEvents } = await client
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  const { data: refs, error: refsError } = await client
    .from('event_source_references')
    .select('id, canonical_event_id, source_id, external_event_id, metadata, active');
  if (refsError) {
    throw new Error(refsError.message);
  }

  const references = refs ?? [];
  const originKeys = new Set<string>();
  const duplicateOriginKeys: string[] = [];
  for (const row of references) {
    const key = `${row.canonical_event_id}|${row.source_id}|${row.external_event_id}`;
    if (originKeys.has(key)) {
      duplicateOriginKeys.push(key);
    }
    originKeys.add(key);
  }

  const withBackfill = references.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return Boolean(metadata?.backfilledAt);
  });
  const withRolePlatform = references.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return Boolean(metadata?.role && metadata?.platform);
  });

  const { data: jobs, error: jobsError } = await client
    .from('source_onboarding_jobs')
    .select('id, normalized_url, hostname, status, duplicate_source_id');
  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const onboardingJobs = jobs ?? [];
  const normalizedUrls = new Set<string>();
  const duplicateNormalizedUrls: string[] = [];
  for (const job of onboardingJobs) {
    if (normalizedUrls.has(job.normalized_url)) {
      duplicateNormalizedUrls.push(job.normalized_url);
    }
    normalizedUrls.add(job.normalized_url);
  }

  const invalidDuplicateSourceIds = onboardingJobs.filter((job) => {
    if (!job.duplicate_source_id) {
      return false;
    }
    return !job.duplicate_source_id.startsWith('source-');
  });

  report.database = {
    canonicalEvents: canonicalEvents ?? 0,
    publishedEvents: publishedEvents ?? 0,
    sourceReferences: references.length,
    activeSourceReferences: references.filter((row) => row.active).length,
    originsBackfilled: withBackfill.length,
    originsWithRoleAndPlatform: withRolePlatform.length,
    duplicateOriginKeys,
    onboardingJobs: onboardingJobs.length,
    duplicateNormalizedUrls,
    invalidDuplicateSourceIds: invalidDuplicateSourceIds.map((job) => ({
      id: job.id,
      duplicateSourceId: job.duplicate_source_id,
    })),
  };

  report.passed =
    duplicateOriginKeys.length === 0 &&
    duplicateNormalizedUrls.length === 0 &&
    invalidDuplicateSourceIds.length === 0 &&
    (canonicalEvents ?? 0) === 65 &&
    withBackfill.length === references.length;

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
