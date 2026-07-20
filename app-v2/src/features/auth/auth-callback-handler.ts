import type { AuthCallbackFlow } from '@/features/auth/auth-redirect-utils';

export interface AuthCallbackParams {
  code?: string | string[];
  returnTo?: string | string[];
  type?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
}

export interface ParsedAuthCallbackParams {
  code: string | null;
  returnTo: string | null;
  flow: AuthCallbackFlow | null;
  error: string | null;
  errorDescription: string | null;
}

function readParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return value[0];
  }

  return null;
}

export function parseAuthCallbackParams(params: AuthCallbackParams): ParsedAuthCallbackParams {
  const type = readParam(params.type);

  return {
    code: readParam(params.code),
    returnTo: readParam(params.returnTo),
    flow: type === 'recovery' ? 'recovery' : type === 'signup' ? 'signup' : null,
    error: readParam(params.error),
    errorDescription: readParam(params.error_description),
  };
}

export function parseAuthCallbackUrl(url: string): ParsedAuthCallbackParams {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));

    const code = params.get('code') ?? hashParams.get('code');
    const returnTo = params.get('returnTo') ?? hashParams.get('returnTo');
    const type = params.get('type') ?? hashParams.get('type');
    const error = params.get('error') ?? hashParams.get('error');
    const errorDescription =
      params.get('error_description') ?? hashParams.get('error_description');

    return {
      code,
      returnTo,
      flow: type === 'recovery' ? 'recovery' : type === 'signup' ? 'signup' : null,
      error,
      errorDescription,
    };
  } catch {
    return {
      code: null,
      returnTo: null,
      flow: null,
      error: null,
      errorDescription: null,
    };
  }
}
