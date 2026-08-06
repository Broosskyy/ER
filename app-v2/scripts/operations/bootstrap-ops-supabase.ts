/**
 * Ops-only Supabase bootstrap — service role only, never anon/publishable key.
 * Import this module before @/data/repositories/registry in operations scripts.
 */
import './load-ops-env';

import {
  assertOpsSupabaseConfigured,
  configureSupabaseClientForOperations,
} from '@/services/supabase/client-service-role';
import { resetSupabaseClient } from '@/services/supabase/client';

if (process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must not be used for operations. Use SUPABASE_SERVICE_ROLE_KEY server-side only.',
  );
}

process.env.ER_OPS_SCRIPT = '1';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';
assertOpsSupabaseConfigured();
configureSupabaseClientForOperations();
resetSupabaseClient();
