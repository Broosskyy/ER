import { afterEach, describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  configureSupabaseClientForOperations,
  getOpsSupabaseClient,
  getSupabaseServiceClient,
  resetSupabaseServiceClient,
} from '@/services/supabase/client-service-role';

describe('supabase client auth config', () => {
  afterEach(() => {
    resetSupabaseServiceClient();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
  });

  it('enables detectSessionInUrl only on web runtimes', () => {
    const source = readFileSync(join(process.cwd(), 'src/services/supabase/client.ts'), 'utf8');
    expect(source).toContain('detectSessionInUrl: isWebRuntime()');
  });

  it('keeps service-role symbols out of the public client module', () => {
    const source = readFileSync(join(process.cwd(), 'src/services/supabase/client.ts'), 'utf8');
    expect(source).not.toMatch(/SERVICE_ROLE/i);
    expect(source).not.toContain('getSupabaseServiceClient');
  });

  it('creates an isolated service-role client for operations mode', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

    configureSupabaseClientForOperations();

    const serviceClient = getSupabaseServiceClient();
    expect(serviceClient).toBeDefined();
    expect(getOpsSupabaseClient()).toBe(serviceClient);
  });
});
