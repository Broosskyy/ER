import type { User, Session } from '@supabase/supabase-js';

import { featureFlags } from '@/core/config/feature-flags';
import { AppError } from '@/core/errors/app-error';
import { getSupabaseClient } from '@/services/supabase/client';

const LOCAL_ADMIN_EMAIL = 'admin@eternalrave.app';
const LOCAL_ADMIN_PASSWORD = 'admin-local-dev';

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

export type AuthStateChangeCallback = (session: AuthSession | null) => void;

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
      throw new AppError('Invalid email or password.', { code: 'UNAUTHORIZED' });
    }

    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new AppError(error?.message ?? 'Login failed.', { code: 'UNAUTHORIZED', cause: error });
    }
    return mapSession(data.session);
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
