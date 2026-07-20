import type { User, Session, AuthError } from '@supabase/supabase-js';

import { featureFlags } from '@/core/config/feature-flags';
import { AppError } from '@/core/errors/app-error';
import type { AuthCallbackParams } from '@/features/auth/auth-callback-handler';
import { parseAuthCallbackParams } from '@/features/auth/auth-callback-handler';
import type { AuthCallbackFlow } from '@/features/auth/auth-redirect-utils';
import { buildAuthCallbackRedirectUrl } from '@/features/auth/auth-redirect-utils';
import { isNetworkAuthError } from '@/features/i18n/auth-errors';
import { getSupabaseClient } from '@/services/supabase/client';

const LOCAL_ADMIN_EMAIL = 'admin@eternalrave.app';
const LOCAL_ADMIN_PASSWORD = 'admin-local-dev';
const LOCAL_USER_EMAIL = 'user@eternalrave.app';
const LOCAL_USER_PASSWORD = 'user-local-dev';

export interface AuthSession {
  user: { id: string; email: string };
  accessToken: string;
  role?: string;
}

let localSession: AuthSession | null = null;

function mapSession(session: Session): AuthSession {
  const role = typeof session.user.app_metadata?.role === 'string'
    ? session.user.app_metadata.role
    : undefined;
  return {
    user: { id: session.user.id, email: session.user.email ?? '' },
    accessToken: session.access_token,
    role,
  };
}

export interface SignUpResult {
  session: AuthSession | null;
  emailConfirmationRequired: boolean;
}

export interface AuthCallbackResult {
  session: AuthSession | null;
  flow: AuthCallbackFlow | null;
}

export interface SignUpOptions {
  returnTo?: string | null;
}

export type AuthStateChangeCallback = (session: AuthSession | null) => void;

function isExistingLocalAccount(email: string): boolean {
  return email === LOCAL_ADMIN_EMAIL || email === LOCAL_USER_EMAIL;
}

function mapAuthServiceError(error: AuthError | null, fallbackMessage: string): AppError {
  if (!error) {
    return new AppError(fallbackMessage, { code: 'UNAUTHORIZED' });
  }

  if (isNetworkAuthError(error)) {
    return new AppError(fallbackMessage, { code: 'NETWORK', cause: error, retryable: true });
  }

  return new AppError(error.message || fallbackMessage, { code: 'UNAUTHORIZED', cause: error });
}

function mapSignUpError(error: AuthError): AppError {
  if (isNetworkAuthError(error)) {
    return new AppError(error.message, { code: 'NETWORK', cause: error, retryable: true });
  }

  return new AppError(error.message ?? 'Registration failed.', {
    code: 'VALIDATION',
    cause: error,
  });
}

export const authService = {
  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    if (!featureFlags.useSupabase) {
      return () => {};
    }

    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      callback(session ? mapSession(session) : null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  },

  async refreshSession(): Promise<AuthSession | null> {
    if (!featureFlags.useSupabase) {
      return localSession;
    }

    const { data, error } = await getSupabaseClient().auth.refreshSession();
    if (error || !data.session) {
      return null;
    }

    return mapSession(data.session);
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    if (!featureFlags.useSupabase) {
      if (email === LOCAL_ADMIN_EMAIL && password === LOCAL_ADMIN_PASSWORD) {
        localSession = {
          user: { id: 'local-admin', email },
          accessToken: 'local-token',
          role: 'owner',
        };
        return localSession;
      }

      if (email === LOCAL_USER_EMAIL && password === LOCAL_USER_PASSWORD) {
        localSession = {
          user: { id: 'local-user', email },
          accessToken: 'local-token',
        };
        return localSession;
      }

      throw new AppError('Invalid email or password.', { code: 'UNAUTHORIZED' });
    }

    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw mapAuthServiceError(error, 'Login failed.');
    }
    return mapSession(data.session);
  },

  async signUp(email: string, password: string, options: SignUpOptions = {}): Promise<SignUpResult> {
    const normalizedEmail = email.trim();

    if (!featureFlags.useSupabase) {
      if (isExistingLocalAccount(normalizedEmail)) {
        throw new AppError('An account with this email already exists.', { code: 'VALIDATION' });
      }

      localSession = {
        user: { id: `local-${normalizedEmail}`, email: normalizedEmail },
        accessToken: 'local-token',
      };

      return {
        session: localSession,
        emailConfirmationRequired: false,
      };
    }

    const emailRedirectTo = buildAuthCallbackRedirectUrl({
      returnTo: options.returnTo,
      flow: 'signup',
    });

    const { data, error } = await getSupabaseClient().auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      throw mapSignUpError(error);
    }

    if (data.session) {
      return {
        session: mapSession(data.session),
        emailConfirmationRequired: false,
      };
    }

    return {
      session: null,
      emailConfirmationRequired: true,
    };
  },

  async resendConfirmationEmail(email: string, returnTo?: string | null): Promise<void> {
    const normalizedEmail = email.trim();

    if (!featureFlags.useSupabase) {
      return;
    }

    const { error } = await getSupabaseClient().auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackRedirectUrl({ returnTo, flow: 'signup' }),
      },
    });

    if (error) {
      throw mapSignUpError(error);
    }
  },

  async resetPasswordForEmail(email: string, returnTo?: string | null): Promise<void> {
    const normalizedEmail = email.trim();

    if (!featureFlags.useSupabase) {
      return;
    }

    const redirectTo = buildAuthCallbackRedirectUrl({
      returnTo,
      flow: 'recovery',
    });

    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      throw mapSignUpError(error);
    }
  },

  async updatePassword(password: string): Promise<void> {
    if (!featureFlags.useSupabase) {
      return;
    }

    const { error } = await getSupabaseClient().auth.updateUser({ password });
    if (error) {
      throw mapSignUpError(error);
    }
  },

  async handleAuthCallback(params: AuthCallbackParams): Promise<AuthCallbackResult> {
    if (!featureFlags.useSupabase) {
      throw new AppError('Auth callback requires Supabase.', { code: 'VALIDATION' });
    }

    const parsed = parseAuthCallbackParams(params);
    if (parsed.error) {
      throw new AppError(parsed.errorDescription ?? parsed.error, {
        code: 'UNAUTHORIZED',
      });
    }

    const client = getSupabaseClient();

    if (parsed.code) {
      const { data, error } = await client.auth.exchangeCodeForSession(parsed.code);
      if (error || !data.session) {
        throw mapAuthServiceError(error, 'Auth callback failed.');
      }

      return {
        session: mapSession(data.session),
        flow: parsed.flow,
      };
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      throw mapAuthServiceError(error, 'Auth callback failed.');
    }

    if (!data.session) {
      throw new AppError('Auth callback failed.', { code: 'UNAUTHORIZED' });
    }

    return {
      session: mapSession(data.session),
      flow: parsed.flow,
    };
  },

  async signOut(): Promise<void> {
    if (!featureFlags.useSupabase) {
      localSession = null;
      return;
    }
    await getSupabaseClient().auth.signOut();
  },

  async getSession(): Promise<AuthSession | null> {
    if (!featureFlags.useSupabase) {
      return localSession;
    }
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session ? mapSession(data.session) : null;
  },

  async getUser(): Promise<User | null> {
    if (!featureFlags.useSupabase) {
      return localSession
        ? ({ id: localSession.user.id, email: localSession.user.email } as User)
        : null;
    }
    const { data } = await getSupabaseClient().auth.getUser();
    return data.user;
  },
};
