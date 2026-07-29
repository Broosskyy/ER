import { afterEach, describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  configureSupabaseClientForOperations,
  getSupabaseClient,
  getSupabaseServiceClient,
  resetSupabaseClient,
} from '@/services/supabase/client';

describe('supabase client auth config', () => {
  afterEach(() => {
    resetSupabaseClient();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
  });

  it('enables detectSessionInUrl only on web runtimes', () => {
    const source = readFileSync(join(process.cwd(), 'src/services/supabase/client.ts'), 'utf8');
    expect(source).toContain('detectSessionInUrl: isWebRuntime()');
  });

  it('routes operations scripts through the service-role client only', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

    configureSupabaseClientForOperations();

    expect(getSupabaseClient()).toBe(getSupabaseServiceClient());
  });
});
