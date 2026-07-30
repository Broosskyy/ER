import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import { isWebRuntime } from '@/platform/runtime-platform';

export type Database = Record<string, unknown>;

let client: SupabaseClient<Database> | null = null;
let serviceClient: SupabaseClient<Database> | null = null;
let useServiceRoleClient = false;

const SERVICE_ROLE_PLACEHOLDER = /your-service-role-key|YOUR_SERVICE_ROLE/i;

function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    env.supabaseUrl ??
    ''
  );
}

export function resolveSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function isSupabaseServiceRoleConfigured(): boolean {
  const key = resolveSupabaseServiceRoleKey();
  return resolveSupabaseUrl().length > 0 && key.length > 0 && !SERVICE_ROLE_PLACEHOLDER.test(key);
}

export function assertOpsSupabaseConfigured(): void {
  const url = resolveSupabaseUrl();
  const serviceRoleKey = resolveSupabaseServiceRoleKey();

  if (!url) {
    throw new AppError(
      'Operations Supabase URL is missing. Set EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL.',
      { code: 'VALIDATION', retryable: false },
    );
  }

  if (!serviceRoleKey || SERVICE_ROLE_PLACEHOLDER.test(serviceRoleKey)) {
    throw new AppError(
      'Operations require SUPABASE_SERVICE_ROLE_KEY. The publishable/anon key must not be used for scheduler, worker, or recovery scripts.',
      { code: 'VALIDATION', retryable: false },
    );
  }
}

export function configureSupabaseClientForOperations(): void {
  assertOpsSupabaseConfigured();
  useServiceRoleClient = true;
  client = null;
  serviceClient = null;
}

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  assertOpsSupabaseConfigured();

  serviceClient ??= createClient<Database>(resolveSupabaseUrl(), resolveSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (useServiceRoleClient) {
    return getSupabaseServiceClient();
  }

  if (!isSupabaseConfigured()) {
    throw new AppError('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.', {
      code: 'VALIDATION',
      retryable: false,
    });
  }

  client ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: isWebRuntime(),
    },
  });

  return client;
}

export function resetSupabaseClient(): void {
  client = null;
  serviceClient = null;
  useServiceRoleClient = false;
}
