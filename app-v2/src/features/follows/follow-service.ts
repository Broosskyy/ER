import type { RealDataDomainEventBus } from '@/features/events/domain/real-data-domain-events';
import { publishEntityFollowDomainEvent } from '@/features/events/domain/real-data-domain-events';

export type FollowEntityType = 'organizer' | 'venue' | 'artist';

export interface FollowRecord {
  entityType: FollowEntityType;
  canonicalEntityId: string;
  followedAt: string;
}

export interface FollowStorage {
  load(): Promise<FollowRecord[]>;
  save(records: FollowRecord[]): Promise<void>;
}

const STORAGE_KEY = '@eternal_rave/follows_v1';

export class AsyncStorageFollowStorage implements FollowStorage {
  constructor(
    private readonly storage: {
      getItem(key: string): Promise<string | null>;
      setItem(key: string, value: string): Promise<void>;
    },
  ) {}

  async load(): Promise<FollowRecord[]> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as FollowRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async save(records: FollowRecord[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

export class InMemoryFollowStorage implements FollowStorage {
  private records: FollowRecord[] = [];

  async load(): Promise<FollowRecord[]> {
    return [...this.records];
  }

  async save(records: FollowRecord[]): Promise<void> {
    this.records = [...records];
  }
}

function followKey(entityType: FollowEntityType, canonicalEntityId: string): string {
  return `${entityType}:${canonicalEntityId}`;
}

export interface FollowServiceOptions {
  storage?: FollowStorage;
  domainEventBus?: RealDataDomainEventBus;
  resolveCanonicalId?: (
    entityType: FollowEntityType,
    entityId: string,
  ) => Promise<string>;
}

export class FollowService {
  private records: FollowRecord[] = [];
  private hydrated = false;

  constructor(private readonly options: FollowServiceOptions = {}) {}

  private get storage(): FollowStorage {
    return this.options.storage ?? new InMemoryFollowStorage();
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) {
      return;
    }
    this.records = this.dedupe(await this.storage.load());
    this.hydrated = true;
  }

  async resolveCanonicalEntityId(
    entityType: FollowEntityType,
    entityId: string,
  ): Promise<string> {
    if (this.options.resolveCanonicalId) {
      return this.options.resolveCanonicalId(entityType, entityId);
    }
    return entityId;
  }

  async follow(entityType: FollowEntityType, entityId: string): Promise<void> {
    await this.hydrate();
    const canonicalEntityId = await this.resolveCanonicalEntityId(entityType, entityId);
    const key = followKey(entityType, canonicalEntityId);
    if (this.records.some((record) => followKey(record.entityType, record.canonicalEntityId) === key)) {
      return;
    }
    this.records.push({
      entityType,
      canonicalEntityId,
      followedAt: new Date().toISOString(),
    });
    await this.storage.save(this.records);
    if (this.options.domainEventBus) {
      publishEntityFollowDomainEvent(this.options.domainEventBus, {
        type: 'entity_followed',
        entityType,
        canonicalEntityId,
      });
    }
  }

  async unfollow(entityType: FollowEntityType, entityId: string): Promise<void> {
    await this.hydrate();
    const canonicalEntityId = await this.resolveCanonicalEntityId(entityType, entityId);
    const key = followKey(entityType, canonicalEntityId);
    this.records = this.records.filter(
      (record) => followKey(record.entityType, record.canonicalEntityId) !== key,
    );
    await this.storage.save(this.records);
    if (this.options.domainEventBus) {
      publishEntityFollowDomainEvent(this.options.domainEventBus, {
        type: 'entity_unfollowed',
        entityType,
        canonicalEntityId,
      });
    }
  }

  async isFollowing(entityType: FollowEntityType, entityId: string): Promise<boolean> {
    await this.hydrate();
    const canonicalEntityId = await this.resolveCanonicalEntityId(entityType, entityId);
    const key = followKey(entityType, canonicalEntityId);
    return this.records.some(
      (record) => followKey(record.entityType, record.canonicalEntityId) === key,
    );
  }

  async list(entityType?: FollowEntityType): Promise<FollowRecord[]> {
    await this.hydrate();
    if (!entityType) {
      return [...this.records];
    }
    return this.records.filter((record) => record.entityType === entityType);
  }

  private dedupe(records: FollowRecord[]): FollowRecord[] {
    const seen = new Set<string>();
    return records.filter((record) => {
      const key = followKey(record.entityType, record.canonicalEntityId);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
