import type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import type { ConnectorHealthStatus } from '@/features/connectors/domain/connector-config';
import type { ConnectorLifecycleState } from '@/features/connectors/domain/connector-lifecycle';

export function formatConnectorHealthStatus(status: ConnectorHealthStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'configuration_required':
      return 'Configuration Required';
    case 'disabled':
      return 'Disabled';
    case 'unsupported':
      return 'Unsupported';
    default:
      return 'Unknown';
  }
}

export function formatConnectorLifecycleState(state: ConnectorLifecycleState): string {
  switch (state) {
    case 'registered':
      return 'Registered';
    case 'configured':
      return 'Configured';
    case 'ready':
      return 'Ready';
    case 'executing':
      return 'Executing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return state;
  }
}

export interface ConnectorCapabilityDisplayItem {
  key: string;
  label: string;
  supported: boolean;
  description: string;
}

export function buildConnectorCapabilityDisplay(
  capabilities: ConnectorCapabilities,
): ConnectorCapabilityDisplayItem[] {
  return [
    {
      key: 'authentication',
      label: 'Authentication',
      supported: capabilities.supportsAuthentication,
      description: 'Connector can use authenticated acquisition flows.',
    },
    {
      key: 'polling',
      label: 'Polling',
      supported: capabilities.supportsPolling,
      description: 'Connector supports scheduled polling acquisition.',
    },
    {
      key: 'webhooks',
      label: 'Webhooks',
      supported: capabilities.supportsWebhook,
      description: 'Connector can receive webhook-triggered acquisition.',
    },
    {
      key: 'pagination',
      label: 'Pagination',
      supported: capabilities.supportsPagination,
      description: 'Connector can paginate through large result sets.',
    },
    {
      key: 'incremental_sync',
      label: 'Incremental Sync',
      supported: capabilities.supportsIncrementalSync,
      description: 'Connector supports incremental synchronization.',
    },
    {
      key: 'manual_execution',
      label: 'Manual Execution',
      supported: false,
      description: 'Manual connector execution is not yet available in the admin CMS.',
    },
    {
      key: 'scheduled_execution',
      label: 'Scheduled Execution',
      supported: capabilities.supportsPolling,
      description: 'Scheduled execution depends on a future scheduler epic.',
    },
  ];
}
