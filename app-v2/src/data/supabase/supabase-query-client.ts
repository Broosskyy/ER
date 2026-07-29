import { AppError } from '@/core/errors/app-error';
import { getSupabaseClient } from '@/services/supabase/client';

export type RawResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

export interface RawQuery extends PromiseLike<RawResult> {
  select(columns?: string, options?: { count?: 'exact' }): RawQuery;
  eq(column: string, value: unknown): RawQuery;
  in(column: string, values: unknown[]): RawQuery;
  order(column: string, options?: { ascending?: boolean }): RawQuery;
  limit(count: number): RawQuery;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): RawQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): RawQuery;
  maybeSingle(): Promise<RawResult>;
  single(): Promise<RawResult>;
}

export type RawClient = { from(table: string): RawQuery };

export function getRawSupabaseClient(): RawClient {
  return getSupabaseClient() as unknown as RawClient;
}

export function throwRepositoryError(error: { message: string }): never {
  throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
}

export function resultOrThrow(result: RawResult): unknown {
  if (result.error) {
    throwRepositoryError(result.error);
  }
  return result.data;
}
