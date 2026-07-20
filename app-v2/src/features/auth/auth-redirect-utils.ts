import { isSafeReturnRoute } from '@/features/auth/auth-route-utils';
import { APP_SCHEME } from '@/platform/linking/app-linking';
import { isWebRuntime } from '@/platform/runtime-platform';

export const AUTH_CALLBACK_PATH = '/auth/callback';

export type AuthCallbackFlow = 'signup' | 'recovery';

export interface AuthCallbackRedirectOptions {
  returnTo?: string | null;
  flow?: AuthCallbackFlow;
}

function getWebOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof globalThis !== 'undefined') {
    const location = (globalThis as { location?: { origin?: string } }).location;
    if (location?.origin) {
      return location.origin;
    }
  }

  return '';
}

export function buildAuthCallbackRedirectUrl(options: AuthCallbackRedirectOptions = {}): string {
  const params = new URLSearchParams();
  const safeReturnTo = isSafeReturnRoute(options.returnTo) ? options.returnTo : null;

  if (safeReturnTo) {
    params.set('returnTo', safeReturnTo);
  }

  if (options.flow) {
    params.set('type', options.flow);
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : '';

  if (isWebRuntime()) {
    const origin = getWebOrigin();
    if (origin) {
      return `${origin}${AUTH_CALLBACK_PATH}${suffix}`;
    }

    return `${AUTH_CALLBACK_PATH}${suffix}`;
  }

  return `${APP_SCHEME}://auth/callback${suffix}`;
}

export function resolvePostAuthRedirect(returnTo: string | null | undefined): string {
  return isSafeReturnRoute(returnTo) ? returnTo : '/';
}

export function resolveAuthCallbackDestination(
  flow: AuthCallbackFlow | null | undefined,
  returnTo: string | null | undefined,
): string {
  if (flow === 'recovery') {
    return '/reset-password';
  }

  return resolvePostAuthRedirect(returnTo);
}
