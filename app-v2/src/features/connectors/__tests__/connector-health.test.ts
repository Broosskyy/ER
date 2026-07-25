import { describe, expect, it } from 'vitest';

import {
  evaluateConnectorConfiguration,
  resolveConnectorHealthStatus,
  resolveConnectorLifecycleState,
} from '@/features/connectors/admin/connector-health';
import { createMockConnectorRegistration } from '@/features/connectors/__tests__/test-helpers';
import { createDefaultConnectorSettings } from '@/features/connectors/domain/connector-config';

describe('connector health', () => {
  it('resolves ready health for valid configuration', () => {
    const registration = createMockConnectorRegistration();
    const settings = createDefaultConnectorSettings();
    const evaluation = evaluateConnectorConfiguration(registration, settings);

    expect(
      resolveConnectorHealthStatus({
        registration,
        settings,
        globalEnabled: true,
        hasValidConfiguration: evaluation.valid,
      }),
    ).toBe('ready');
  });

  it('resolves disabled health when connector is disabled', () => {
    const registration = createMockConnectorRegistration();
    const settings = { ...createDefaultConnectorSettings(), enabled: false };

    expect(
      resolveConnectorHealthStatus({
        registration,
        settings,
        globalEnabled: true,
        hasValidConfiguration: true,
      }),
    ).toBe('disabled');
  });

  it('resolves lifecycle state', () => {
    const registration = createMockConnectorRegistration();
    const settings = createDefaultConnectorSettings();

    expect(resolveConnectorLifecycleState(registration, settings, true)).toBe('ready');
    expect(resolveConnectorLifecycleState(registration, settings, false)).toBe('configured');
  });
});
