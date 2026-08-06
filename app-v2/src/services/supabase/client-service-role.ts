import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';

import type { Database } from './database.types';
import { resolveSupabaseUrl } from './client';

export type { Database } from './database.types';

let serviceClient: SupabaseClient<Database> | null = null;
let useServiceRoleClient = false;

const SERVICE_ROLE_PLACEHOLDER = /your-service-role-key|YOUR_SERVICE_ROLE/i;

/** Ops-only — never import from public app routes or shared registry. */
export function resolveSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function isSupabaseServiceRoleConfigured(): boolean {
  const key = resolveSupabaseServiceRoleKey();
  return resolveSupabaseUrl().length > 0 && key.length > 0 && !SERVICE_ROLE_PLACEHOLDER.test(key);
}

export function assertOpsSupabaseConfigured(): void {
  const url = resolveSupabaseUrl() || process.env.SUPABASE_URL;
  const serviceRoleKey = resolveSupabaseServiceRoleKey();

  if (!url) {
    throw new AppError(
      'Operations Supabase URL is missing. Set EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL.',
      { code: 'VALIDATION', retryable: false },
    );
  }

  if (!serviceRoleKey || SERVICE_ROLE_PLACEHOLDER.test(serviceRoleKey)) {
    throw new AppError(
      'Operations require a configured service-role key. The publishable anon key must not be used for scheduler, worker, or recovery scripts.',
      { code: 'VALIDATION', retryable: false },
    );
  }
}

export function configureSupabaseClientForOperations(): void {
  assertOpsSupabaseConfigured();
  useServiceRoleClient = true;
  serviceClient = null;
}

/** Ops-only service-role client. Import from this module in scripts — not from client.ts. */
export function getSupabaseServiceClient(): SupabaseClient<Database> {
  assertOpsSupabaseConfigured();

  const url = process.env.SUPABASE_URL ?? resolveSupabaseUrl() ?? env.supabaseUrl;

  serviceClient ??= createClient<Database>(url, resolveSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

/** Routes getSupabaseClient() to service role when ops mode is enabled (scripts only). */
export function getOpsSupabaseClient(): SupabaseClient<Database> {
  if (useServiceRoleClient) {
    return getSupabaseServiceClient();
  }
  throw new AppError('Operations mode is not configured. Call configureSupabaseClientForOperations first.', {
    code: 'VALIDATION',
    retryable: false,
  });
}

export function resetSupabaseServiceClient(): void {
  serviceClient = null;
  useServiceRoleClient = false;
}
