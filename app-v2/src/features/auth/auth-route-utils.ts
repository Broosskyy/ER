const UNSAFE_PATH_PREFIXES = ['/login', '/register', '/admin/login', '/auth/callback', '/forgot-password', '/reset-password'];

export function isSafeReturnRoute(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') {
    return false;
  }

  if (!path.startsWith('/')) {
    return false;
  }

  if (path.includes('://') || path.startsWith('//')) {
    return false;
  }

  for (const prefix of UNSAFE_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`)) {
      return false;
    }
  }

  return true;
}

export function buildLoginHref(returnTo?: string | null): string {
  if (isSafeReturnRoute(returnTo)) {
    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return '/login';
}

export function buildRegisterHref(returnTo?: string | null): string {
  if (isSafeReturnRoute(returnTo)) {
    return `/register?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return '/register';
}

export function buildForgotPasswordHref(returnTo?: string | null): string {
  if (isSafeReturnRoute(returnTo)) {
    return `/forgot-password?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return '/forgot-password';
}

export const CREATE_HUB_RETURN_ROUTE = '/create';
export const PROFILE_RETURN_ROUTE = '/profile';

export function getCreateAuthLinks(): { loginHref: string; registerHref: string } {
  return {
    loginHref: buildLoginHref(CREATE_HUB_RETURN_ROUTE),
    registerHref: buildRegisterHref(CREATE_HUB_RETURN_ROUTE),
  };
}

export function getProfileAuthLinks(): { loginHref: string; registerHref: string } {
  return {
    loginHref: buildLoginHref(PROFILE_RETURN_ROUTE),
    registerHref: buildRegisterHref(PROFILE_RETURN_ROUTE),
  };
}

export function resolveProfileAuthView(isAuthenticated: boolean): 'signed-in' | 'signed-out' {
  return isAuthenticated ? 'signed-in' : 'signed-out';
}
