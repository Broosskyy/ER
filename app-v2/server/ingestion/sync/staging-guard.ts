export const STAGING_PROJECT_REF = 'gnkjzinwvmrxcadwebhv';
export const PRODUCTION_PROJECT_REF = 'irgsllewfrxvbtznqmxh';
export const EXPECTED_STAGING_PROJECT_NAME = 'Eternal-Rave';

export interface VerifiedStagingTarget {
  ref: string;
  name: string;
}

export function assertNotProductionRef(ref: string, name: string): void {
  if (ref === PRODUCTION_PROJECT_REF || /prod/i.test(name)) {
    throw new Error(`production_target_forbidden:${ref}:${name}`);
  }
}

export function assertStagingTarget(ref: string, name: string): VerifiedStagingTarget {
  assertNotProductionRef(ref, name);
  if (ref !== STAGING_PROJECT_REF || name !== EXPECTED_STAGING_PROJECT_NAME) {
    throw new Error(`staging_target_mismatch:${ref}:${name}`);
  }
  return { ref, name };
}
