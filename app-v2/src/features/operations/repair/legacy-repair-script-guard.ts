const OFFICIAL_REPAIR_ENTRYPOINT = 'scripts/operations/repair-events.ts';

const LEGACY_REPAIR_SCRIPT_ACK_ENV = 'LEGACY_REPAIR_SCRIPT_ACK';

export const LEGACY_REPAIR_SCRIPT_WARNING =
  `DEPRECATED: Direct production repair scripts are unsafe. Use ${OFFICIAL_REPAIR_ENTRYPOINT} for read-only preflight and signed repair plans. Apply remains disabled until durable repair-run schema support is installed.`;

export function assertLegacyRepairScriptAllowed(
  scriptId: string,
  argv: string[] = process.argv,
): void {
  if (argv.includes('--i-understand-legacy-risk') || process.env[LEGACY_REPAIR_SCRIPT_ACK_ENV] === '1') {
    console.warn(LEGACY_REPAIR_SCRIPT_WARNING);
    console.warn(`Legacy repair script acknowledged: ${scriptId}`);
    return;
  }

  throw new Error(
    `${LEGACY_REPAIR_SCRIPT_WARNING}\nBlocked legacy repair script: ${scriptId}. Set ${LEGACY_REPAIR_SCRIPT_ACK_ENV}=1 or pass --i-understand-legacy-risk to proceed.`,
  );
}

export const LEGACY_MUTATING_REPAIR_SCRIPTS = [
  'scripts/operations/_sprint434-historical-production-repair.ts',
  'scripts/operations/_sprint431-ticket-io-production-repair.ts',
  'scripts/operations/_sprint431-apply-production-fixes.ts',
  'scripts/operations/_sprint36-republish-queued.ts',
  'scripts/operations/_bootshaus-trust-reevaluation-repair.ts',
  'scripts/operations/_bootshaus-canonical-entity-repair-apply.ts',
  'scripts/operations/_bootshaus-production-closure-apply.ts',
] as const;
