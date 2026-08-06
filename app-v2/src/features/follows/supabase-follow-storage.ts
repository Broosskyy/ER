import { getRawSupabaseClient, type RawClient } from '@/data/supabase/supabase-query-client';
import { getSupabaseClient } from '@/services/supabase/client';

import type { FollowEntityType, FollowRecord, FollowStorage } from './follow-service';

interface FollowRow {
  entity_type: FollowEntityType;
  entity_id: string;
  followed_at: string;
}

export class SupabaseFollowStorage implements FollowStorage {
  constructor(private readonly clientFactory: () => RawClient = getRawSupabaseClient) {}

  private async requireUserId(): Promise<string> {
    const { data, error } = await getSupabaseClient().auth.getUser();
    if (error || !data.user?.id) {
      throw new Error('Follow erfordert eine angemeldete Session.');
    }
    return data.user.id;
  }

  async load(): Promise<FollowRecord[]> {
    const userId = await this.requireUserId();
    const { data, error } = await this.clientFactory()
      .from('entity_follows')
      .select('entity_type, entity_id, followed_at')
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return ((data as FollowRow[] | null) ?? []).map((row) => ({
      entityType: row.entity_type,
      canonicalEntityId: row.entity_id,
      followedAt: row.followed_at,
    }));
  }

  async save(records: FollowRecord[]): Promise<void> {
    const userId = await this.requireUserId();
    const client = this.clientFactory();
    const { data: existing, error: existingError } = await client
      .from('entity_follows')
      .select('entity_type, entity_id')
      .eq('user_id', userId);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingRows = (existing as Array<{ entity_type: FollowEntityType; entity_id: string }> | null) ?? [];
    const nextKeys = new Set(
      records.map((record) => `${record.entityType}:${record.canonicalEntityId}`),
    );
    const existingKeys = new Set(
      existingRows.map((row) => `${row.entity_type}:${row.entity_id}`),
    );

    const toInsert = records.filter(
      (record) => !existingKeys.has(`${record.entityType}:${record.canonicalEntityId}`),
    );
    const toDelete = existingRows.filter(
      (row) => !nextKeys.has(`${row.entity_type}:${row.entity_id}`),
    );

    if (toInsert.length > 0) {
      const { error } = await client.from('entity_follows').upsert(
        toInsert.map((record) => ({
          user_id: userId,
          entity_type: record.entityType,
          entity_id: record.canonicalEntityId,
          followed_at: record.followedAt,
        })) as unknown as Record<string, unknown>[],
        { onConflict: 'user_id,entity_type,entity_id' },
      );
      if (error) {
        throw new Error(error.message);
      }
    }

    for (const row of toDelete) {
      const { error } = await client
        .from('entity_follows')
        .delete()
        .eq('user_id', userId)
        .eq('entity_type', row.entity_type)
        .eq('entity_id', row.entity_id);
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  async countFollowers(entityType: FollowEntityType, entityId: string): Promise<number> {
    const { count, error } = await this.clientFactory()
      .from('entity_follows')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      throw new Error(error.message);
    }

    return count ?? 0;
  }
}
