export const STAGING_PROJECT_REF = 'gnkjzinwvmrxcadwebhv';
export const EXPECTED_STAGING_PROJECT_NAME = 'Eternal-Rave';
export const PRODUCTION_PROJECT_REF_ENV = 'ETERNAL_RAVE_PRODUCTION_PROJECT_REF';

const PRODUCTION_NAME_PATTERN = /(^|[-_\s])prod(?:uction)?($|[-_\s])/i;

export interface VerifiedStagingTarget {
  ref: string;
  name: string;
}

export interface VerifiedProductionTarget {
  ref: string;
  name: string;
}

export type ProjectRefEnvironment = Record<string, string | undefined>;

export function getConfiguredProductionProjectRef(
  env: ProjectRefEnvironment = process.env,
): string | undefined {
  const configured = env[PRODUCTION_PROJECT_REF_ENV]?.trim();
  return configured || undefined;
}

export function assertNotProductionRef(
  ref: string,
  name: string,
  configuredProductionRef = getConfiguredProductionProjectRef(),
): void {
  if (
    (configuredProductionRef && ref === configuredProductionRef) ||
    PRODUCTION_NAME_PATTERN.test(name)
  ) {
    throw new Error(`production_target_forbidden:${ref}:${name}`);
  }
}

export function assertProductionTarget(
  ref: string,
  name: string,
  configuredProductionRef = getConfiguredProductionProjectRef(),
): VerifiedProductionTarget {
  if (!configuredProductionRef) {
    throw new Error(`production_target_not_configured:${ref}:${name}`);
  }
  if (configuredProductionRef === STAGING_PROJECT_REF) {
    throw new Error(`production_target_invalid_staging_ref:${configuredProductionRef}`);
  }
  if (ref !== configuredProductionRef) {
    throw new Error(`production_target_mismatch:${ref}:${name}`);
  }
  if (!PRODUCTION_NAME_PATTERN.test(name)) {
    throw new Error(`production_target_name_mismatch:${ref}:${name}`);
  }
  return { ref, name };
}

export function assertStagingTarget(ref: string, name: string): VerifiedStagingTarget {
  assertNotProductionRef(ref, name);
  if (ref !== STAGING_PROJECT_REF || name !== EXPECTED_STAGING_PROJECT_NAME) {
    throw new Error(`staging_target_mismatch:${ref}:${name}`);
  }
  return { ref, name };
}
