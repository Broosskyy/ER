/**
 * Official repair entry point. This release is deliberately read-only.
 * Apply support remains disabled until durable repair-run, lease, change-ledger,
 * and manual-lock safety schema support exists.
 */
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);

const APPLY_DISABLED =
  'Production apply is disabled until durable repair-run, lease, change-ledger and manual-lock safety schema support is installed.';

if (args.has('--apply') || args.has('--confirm-production')) {
  throw new Error(APPLY_DISABLED);
}

function readValidatePlanPath(): string | undefined {
  const index = rawArgs.findIndex((arg) => arg === '--validate-plan');
  if (index < 0) {
    return undefined;
  }
  return rawArgs[index + 1];
}

async function main(): Promise<void> {
  const validatePlanPath = readValidatePlanPath();

  if (validatePlanPath) {
    await import('./bootstrap-ops-supabase');
    const { readRepairPlanArtifact } = await import(
      '@/features/operations/repair/repair-plan-artifact'
    );
    const { validateRepairPlanArtifact } = await import(
      '@/features/operations/repair/repair-plan-validator'
    );
    const { getSupabaseServiceClient } = await import('@/services/supabase/client-service-role');

    const plan = readRepairPlanArtifact(validatePlanPath);
    const result = await validateRepairPlanArtifact(plan, {
      client: getSupabaseServiceClient(),
      supabaseUrl: process.env.SUPABASE_URL,
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) {
      process.exitCode = 1;
    }
    return;
  }

  if (args.has('--post-audit')) {
    await import('./_sprint434-historical-production-audit');
    return;
  }

  await import('./bootstrap-ops-supabase');
  const { getSupabaseServiceClient } = await import('@/services/supabase/client-service-role');
  const { runRepairPreflight, buildRepairPlan } = await import(
    '@/features/operations/repair/repair-plan-builder'
  );
  const { writeRepairPlanArtifact } = await import('@/features/operations/repair/repair-plan-artifact');
  const { validateRepairPlanArtifact } = await import('@/features/operations/repair/repair-plan-validator');

  const client = getSupabaseServiceClient();
  const supabaseUrl = process.env.SUPABASE_URL;

  if (args.has('--plan')) {
    const buildResult = await buildRepairPlan(client, { supabaseUrl });
    console.log(JSON.stringify(buildResult.preflight, null, 2));

    if (!buildResult.preflight.ok) {
      process.exitCode = 1;
      return;
    }

    if (!buildResult.plan) {
      console.log('No repair changes detected. Plan artifact was not written.');
      return;
    }

    const { plan, artifactPath } = writeRepairPlanArtifact(buildResult.plan);
    const validation = await validateRepairPlanArtifact(plan, { client, supabaseUrl });
    console.log(
      JSON.stringify(
        {
          artifactPath,
          summary: plan.summary,
          validation,
        },
        null,
        2,
      ),
    );
    if (!validation.valid) {
      process.exitCode = 1;
    }
    return;
  }

  const preflight = await runRepairPreflight(client, supabaseUrl);
  console.log(JSON.stringify(preflight, null, 2));
  if (!preflight.ok) {
    process.exitCode = 1;
  }
}

void main();
