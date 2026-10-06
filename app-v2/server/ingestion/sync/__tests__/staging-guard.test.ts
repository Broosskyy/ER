import { describe, expect, it } from 'vitest';

import {
  EXPECTED_STAGING_PROJECT_NAME,
  PRODUCTION_PROJECT_REF_ENV,
  STAGING_PROJECT_REF,
  assertNotProductionRef,
  assertProductionTarget,
  assertStagingTarget,
  getConfiguredProductionProjectRef,
} from '../staging-guard';

describe('staging and production project guards', () => {
  it('has no implicit production project ref when configuration is absent', () => {
    expect(getConfiguredProductionProjectRef({})).toBeUndefined();
    expect(PRODUCTION_PROJECT_REF_ENV).toBe('ETERNAL_RAVE_PRODUCTION_PROJECT_REF');
  });

  it('accepts only the exact Eternal Rave staging target', () => {
    expect(assertStagingTarget(STAGING_PROJECT_REF, EXPECTED_STAGING_PROJECT_NAME)).toEqual({
      ref: STAGING_PROJECT_REF,
      name: EXPECTED_STAGING_PROJECT_NAME,
    });

    expect(() =>
      assertStagingTarget('some-other-project', EXPECTED_STAGING_PROJECT_NAME),
    ).toThrow('staging_target_mismatch');
  });

  it('does not treat an unrelated project ref as production unless explicitly configured', () => {
    expect(() => assertNotProductionRef('unrelated-project-ref', 'Panda Bande', '')).not.toThrow();
  });

  it('fails closed when production is not explicitly configured', () => {
    expect(() =>
      assertProductionTarget('eternal-rave-production', 'Eternal-Rave-Production', ''),
    ).toThrow('production_target_not_configured');
  });

  it('refuses to configure staging itself as production', () => {
    expect(() =>
      assertProductionTarget(
        STAGING_PROJECT_REF,
        'Eternal-Rave-Production',
        STAGING_PROJECT_REF,
      ),
    ).toThrow('production_target_invalid_staging_ref');
  });

  it('requires both the configured production ref and an explicit production name', () => {
    const productionRef = 'eternal-rave-production';

    expect(() =>
      assertProductionTarget('different-ref', 'Eternal-Rave-Production', productionRef),
    ).toThrow('production_target_mismatch');

    expect(() =>
      assertProductionTarget(productionRef, 'Eternal-Rave', productionRef),
    ).toThrow('production_target_name_mismatch');

    expect(
      assertProductionTarget(productionRef, 'Eternal-Rave-Production', productionRef),
    ).toEqual({
      ref: productionRef,
      name: 'Eternal-Rave-Production',
    });
  });
});
