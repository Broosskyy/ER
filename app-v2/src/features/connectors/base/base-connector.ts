import type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import type {
  Connector,
  ConnectorValidationResult,
} from '@/features/connectors/contracts/connector';
import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import {
  buildConnectorResultStatistics,
  createEmptyConnectorResult,
  type ConnectorResult,
} from '@/features/connectors/contracts/connector-result';

export abstract class BaseConnector implements Connector {
  abstract readonly connectorKey: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: ConnectorCapabilities;

  describeCapabilities(): ConnectorCapabilities {
    return this.capabilities;
  }

  abstract validateConfiguration(context: ConnectorContext): ConnectorValidationResult;

  abstract execute(context: ConnectorContext): Promise<ConnectorResult>;

  protected createSuccessResult(
    partial: Partial<ConnectorResult> & Pick<ConnectorResult, 'candidates'>,
    durationMs: number,
  ): ConnectorResult {
    const warnings = partial.warnings ?? [];
    const errors = partial.errors ?? [];
    return {
      status: 'completed',
      candidates: partial.candidates,
      warnings,
      errors,
      statistics: buildConnectorResultStatistics({
        candidates: partial.candidates,
        warnings,
        errors,
        skippedCount: partial.statistics?.skippedCount,
      }),
      diagnostics: partial.diagnostics ?? {},
      durationMs,
      metadata: partial.metadata ?? {},
    };
  }

  protected createFailureResult(
    partial: Partial<ConnectorResult>,
    durationMs: number,
  ): ConnectorResult {
    const base = createEmptyConnectorResult({
      status: 'failed',
      durationMs,
      ...partial,
    });
    return {
      ...base,
      statistics: buildConnectorResultStatistics(base),
    };
  }
}
