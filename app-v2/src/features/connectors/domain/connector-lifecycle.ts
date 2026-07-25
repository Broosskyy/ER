/**
 * Connector lifecycle states (configuration metadata only — no runtime engine).
 *
 * Registered → Configured → Ready → Executing → Completed | Failed
 */
export const CONNECTOR_LIFECYCLE_STATES = [
  'registered',
  'configured',
  'ready',
  'executing',
  'completed',
  'failed',
] as const;

export type ConnectorLifecycleState = (typeof CONNECTOR_LIFECYCLE_STATES)[number];

export function isConnectorLifecycleState(value: string): value is ConnectorLifecycleState {
  return (CONNECTOR_LIFECYCLE_STATES as readonly string[]).includes(value);
}
