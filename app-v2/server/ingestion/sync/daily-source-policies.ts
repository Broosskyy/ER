import { AFFENKAEFIG_CONNECTOR_ID } from '../../official-connectors/affenkaefig/constants';
import { BOOTSHAUS_CONNECTOR_ID } from '../../official-connectors/bootshaus/constants';
import { RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID } from '../../official-connectors/rausgegangen-discovery/constants';
import type { SourceWriteScope } from '../../official-connectors/source-operational-config';

/**
 * Every daily source must be explicitly certified here AND have a separate
 * serialized GitHub Actions workflow. Adding a connector to the registry alone
 * never grants automatic writes to the database serving the live app.
 */
export interface DailySourcePolicy {
  readonly connectorId: string;
  readonly writeScope: SourceWriteScope;
  readonly minimumParsed: number;
  readonly maxDetailPages: number;
  readonly maxNewEvents: number;
  readonly maxExistingUpdates: number;
  readonly maxTicketChanges: number;
}

export const DAILY_SOURCE_POLICIES = {
  [BOOTSHAUS_CONNECTOR_ID]: {
    connectorId: BOOTSHAUS_CONNECTOR_ID,
    writeScope: 'upsert',
    minimumParsed: 8,
    maxDetailPages: 40,
    maxNewEvents: 8,
    maxExistingUpdates: 25,
    maxTicketChanges: 25,
  },
  [AFFENKAEFIG_CONNECTOR_ID]: {
    connectorId: AFFENKAEFIG_CONNECTOR_ID,
    writeScope: 'upsert',
    minimumParsed: 2,
    maxDetailPages: 40,
    maxNewEvents: 8,
    maxExistingUpdates: 25,
    maxTicketChanges: 25,
  },
  'stadtgarten-official': {
    connectorId: 'stadtgarten-official',
    writeScope: 'upsert',
    minimumParsed: 1,
    maxDetailPages: 40,
    maxNewEvents: 8,
    maxExistingUpdates: 12,
    maxTicketChanges: 12,
  },
  'zakk-official': {
    connectorId: 'zakk-official',
    writeScope: 'upsert',
    minimumParsed: 1,
    maxDetailPages: 30,
    maxNewEvents: 6,
    maxExistingUpdates: 12,
    maxTicketChanges: 12,
  },
  [RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID]: {
    connectorId: RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID,
    // A bounded daily batch may now create NEW identity-safe Rausgegangen events.
    // Price, sale status and checkout are independently verified; a missing
    // ticket NEVER turns into a fabricated free/sold-out/available claim.
    writeScope: 'upsert',
    minimumParsed: 1,
    maxDetailPages: 40,
    maxNewEvents: 8,
    maxExistingUpdates: 12,
    maxTicketChanges: 12,
  },
} as const satisfies Record<string, DailySourcePolicy>;

export function getDailySourcePolicy(connectorId: string): DailySourcePolicy | undefined {
  return Object.prototype.hasOwnProperty.call(DAILY_SOURCE_POLICIES, connectorId)
    ? DAILY_SOURCE_POLICIES[connectorId as keyof typeof DAILY_SOURCE_POLICIES]
    : undefined;
}
