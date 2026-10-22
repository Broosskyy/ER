import type { OfficialSourceType } from './connector-contract';

export interface SourceRetryPolicyOverride {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

export type SourceWriteScope = 'upsert' | 'existing_only';

export interface SourceOperationalConfig {
  connectorId: string;
  enabled: boolean;
  writeScope?: SourceWriteScope;
  sourceType: OfficialSourceType;
  defaultIntervalMinutes: number;
  maxConcurrency: number;
  requestSpacingMs: number;
  timeoutMs: number;
  expectedMinParsedOnSuccess: number;
  retryPolicy?: SourceRetryPolicyOverride;
}

export const DEFAULT_SOURCE_OPERATIONAL_CONFIG: Omit<SourceOperationalConfig, 'connectorId' | 'sourceType'> = {
  enabled: true,
  defaultIntervalMinutes: 360,
  maxConcurrency: 3,
  requestSpacingMs: 0,
  timeoutMs: 30_000,
  expectedMinParsedOnSuccess: 5,
};

export class SourceOperationalConfigRegistry {
  private readonly configs = new Map<string, SourceOperationalConfig>();

  register(config: SourceOperationalConfig): void {
    this.configs.set(config.connectorId, config);
  }

  get(connectorId: string): SourceOperationalConfig | undefined {
    return this.configs.get(connectorId);
  }

  isEnabled(connectorId: string): boolean {
    return this.configs.get(connectorId)?.enabled ?? false;
  }

  list(): SourceOperationalConfig[] {
    return [...this.configs.values()].sort((left, right) =>
      left.connectorId.localeCompare(right.connectorId),
    );
  }
}

let defaultOperationalRegistry: SourceOperationalConfigRegistry | undefined;

export function getSourceOperationalConfigRegistry(): SourceOperationalConfigRegistry {
  if (!defaultOperationalRegistry) {
    defaultOperationalRegistry = new SourceOperationalConfigRegistry();
  }
  return defaultOperationalRegistry;
}

export function resetSourceOperationalConfigRegistryForTests(): void {
  defaultOperationalRegistry = undefined;
}

export function registerDefaultSourceOperationalConfigs(
  registry = getSourceOperationalConfigRegistry(),
): void {
  if (!registry.get('bootshaus-official')) {
    registry.register({
      connectorId: 'bootshaus-official',
      sourceType: 'venue_club',
      ...DEFAULT_SOURCE_OPERATIONAL_CONFIG,
      maxConcurrency: 3,
      expectedMinParsedOnSuccess: 10,
    });
  }
  if (!registry.get('affenkaefig-official')) {
    registry.register({
      connectorId: 'affenkaefig-official',
      sourceType: 'organizer',
      ...DEFAULT_SOURCE_OPERATIONAL_CONFIG,
      maxConcurrency: 2,
      expectedMinParsedOnSuccess: 3,
    });
  }
  if (!registry.get('zakk-official')) {
    registry.register({
      connectorId: 'zakk-official',
      sourceType: 'venue_club',
      ...DEFAULT_SOURCE_OPERATIONAL_CONFIG,
      writeScope: 'upsert',
      expectedMinParsedOnSuccess: 1,
      maxConcurrency: 2,
      requestSpacingMs: 800,
    });
  }
  if (!registry.get('rausgegangen-discovery')) {
    registry.register({
      connectorId: 'rausgegangen-discovery',
      sourceType: 'event_platform',
      ...DEFAULT_SOURCE_OPERATIONAL_CONFIG,
      writeScope: 'upsert',
      defaultIntervalMinutes: 720,
      maxConcurrency: 2,
      requestSpacingMs: 1500,
      timeoutMs: 30000,
      expectedMinParsedOnSuccess: 1,
      retryPolicy: {
        maxAttempts: 2,
        initialDelayMs: 5000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
      },
    });
  }
}
