export type EntityType = 'organizer' | 'venue' | 'artist' | 'event';

export type EntityResolutionDecision =
  | 'matched'
  | 'review_required'
  | 'keep_separate'
  | 'manual_override'
  | 'unmatched';

export interface EntityIdentityAlias {
  entityType: EntityType;
  canonicalId: string;
  aliasType: 'external_id' | 'normalized_name' | 'url' | 'domain' | 'social_handle' | 'manual';
  aliasValue: string;
  sourceId?: string;
  createdAt: string;
  createdBy?: string;
  originalAlias?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityResolutionDecisionRecord {
  entityType: EntityType;
  candidateKey: string;
  decision: 'keep_separate' | 'manual_override';
  canonicalId?: string;
  decidedBy: string;
  decidedAt: string;
  reason: string;
  sourceId?: string;
  sourceExternalId?: string;
  candidateEntityId?: string;
  confidence?: number;
  normalizedInput?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityResolutionOutcome {
  entityType: EntityType;
  decision: EntityResolutionDecision;
  canonicalId?: string;
  confidenceScore: number;
  candidateIds: string[];
  reasonCodes: string[];
  warning?: string;
}

export interface EntityAliasStore {
  findCanonicalId(
    entityType: EntityType,
    aliasType: EntityIdentityAlias['aliasType'],
    aliasValue: string,
    sourceId?: string,
  ): string | undefined;
  listAliases(entityType: EntityType, canonicalId: string): EntityIdentityAlias[];
  saveAlias(alias: EntityIdentityAlias): void;
  getDecision(entityType: EntityType, candidateKey: string): EntityResolutionDecisionRecord | undefined;
  saveDecision(record: EntityResolutionDecisionRecord): void;
}

/** Persisted stores implement initialize() and must be hydrated before reads in Supabase mode. */
export interface InitializableEntityAliasStore extends EntityAliasStore {
  initialize(): Promise<void>;
  isInitialized(): boolean;
  flush(): Promise<void>;
}

export function isInitializableEntityAliasStore(
  store: EntityAliasStore,
): store is InitializableEntityAliasStore {
  return (
    'initialize' in store &&
    typeof store.initialize === 'function' &&
    'isInitialized' in store &&
    typeof store.isInitialized === 'function'
  );
}
