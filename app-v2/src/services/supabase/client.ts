import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import { isWebRuntime } from '@/platform/runtime-platform';

import type { Database } from './database.types';

export type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

export function resetSupabaseClients(): void {
  client = null;
}

/** Public Supabase URL — safe for client bundle (publishable env only). */
export function resolveSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.supabaseUrl ?? '';
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AppError(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      { code: 'VALIDATION', retryable: false },
    );
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
}
