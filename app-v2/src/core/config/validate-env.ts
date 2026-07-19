export interface EnvValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface EnvValidationOptions {
  production?: boolean;
}

function isPlausibleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateEnvironment(options: EnvValidationOptions = {}): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];
  const production = options.production ?? process.env.NODE_ENV === 'production';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';

  if (process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    issues.push({
      level: 'error',
      code: 'SERVICE_ROLE_IN_CLIENT',
      message: 'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must not be set in client environments.',
    });
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && production) {
    issues.push({
      level: 'warning',
      code: 'SERVICE_ROLE_PRESENT',
      message: 'SUPABASE_SERVICE_ROLE_KEY is present in the build environment (server-side only).',
    });
  }

  if (useSupabase) {
    if (!supabaseUrl) {
      issues.push({
        level: 'error',
        code: 'MISSING_SUPABASE_URL',
        message: 'EXPO_PUBLIC_SUPABASE_URL is required when EXPO_PUBLIC_USE_SUPABASE=true.',
      });
    } else if (!isPlausibleUrl(supabaseUrl)) {
      issues.push({
        level: 'error',
        code: 'INVALID_SUPABASE_URL',
        message: 'EXPO_PUBLIC_SUPABASE_URL is not a valid URL.',
      });
    } else if (production && /localhost|127\.0\.0\.1/i.test(supabaseUrl)) {
      issues.push({
        level: 'error',
        code: 'LOCALHOST_SUPABASE_URL',
        message: 'Production configuration must not point to localhost.',
      });
    }

    if (!supabaseAnonKey) {
      issues.push({
        level: 'error',
        code: 'MISSING_SUPABASE_ANON_KEY',
        message: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is required when EXPO_PUBLIC_USE_SUPABASE=true.',
      });
    }
  }

  return issues;
}

export function assertValidEnvironment(options: EnvValidationOptions = {}): void {
  const issues = validateEnvironment(options);
  const errors = issues.filter((issue) => issue.level === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  }
}
