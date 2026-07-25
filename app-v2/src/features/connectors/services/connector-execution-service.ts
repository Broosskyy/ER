import { AppError } from '@/core/errors/app-error';
import { canManageConnectors } from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import type {
  ConnectorExecutionRequest,
  ConnectorExecutionResult,
} from '@/features/connectors/contracts/connector-execution';
import type { ConnectorExecutionEngine } from '@/features/connectors/services/connector-execution-engine';

function assertCanExecute(role: AdminRole | null): void {
  if (!canManageConnectors(role)) {
    throw new AppError('You do not have permission to execute connectors.', { code: 'UNAUTHORIZED' });
  }
}

/**
 * Application-level manual execution entry point.
 * All connector runs must go through ConnectorExecutionEngine.
 */
export class ConnectorExecutionService {
  constructor(private readonly engine: ConnectorExecutionEngine) {}

  async executeEndpoint(
    role: AdminRole | null,
    request: ConnectorExecutionRequest,
    options: { signal?: AbortSignal; requestedBy?: string } = {},
  ): Promise<ConnectorExecutionResult> {
    assertCanExecute(role);

    return this.engine.execute(
      {
        ...request,
        trigger: request.trigger ?? 'manual',
        requestedBy: request.requestedBy ?? options.requestedBy,
      },
      { signal: options.signal },
    );
  }
}
