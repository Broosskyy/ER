import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '@/core/config/validate-env';

describe('validateEnvironment', () => {
  it('flags service role in client env', () => {
    const issues = validateEnvironment({
      production: true,
    });

    expect(issues.some((issue) => issue.code === 'SERVICE_ROLE_IN_CLIENT')).toBe(
      process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? true : false,
    );
  });

  it('requires supabase config when enabled', () => {
    const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const originalFlag = process.env.EXPO_PUBLIC_USE_SUPABASE;

    process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';

    const issues = validateEnvironment({ production: false });
    expect(issues.map((issue) => issue.code)).toContain('MISSING_SUPABASE_URL');
    expect(issues.map((issue) => issue.code)).toContain('MISSING_SUPABASE_ANON_KEY');

    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    process.env.EXPO_PUBLIC_USE_SUPABASE = originalFlag;
  });

  it('rejects localhost supabase url in production', () => {
    const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const originalFlag = process.env.EXPO_PUBLIC_USE_SUPABASE;

    process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const issues = validateEnvironment({ production: true });
    expect(issues.map((issue) => issue.code)).toContain('LOCALHOST_SUPABASE_URL');

    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    process.env.EXPO_PUBLIC_USE_SUPABASE = originalFlag;
  });
});
