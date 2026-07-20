import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getErrorMessage } from '@/core/errors/app-error';
import type { AuthCallbackParams } from '@/features/auth/auth-callback-handler';
import {
  authService,
  type AuthCallbackResult,
  type AuthSession,
  type SignUpOptions,
  type SignUpResult,
} from '@/services/supabase/auth-service';

export interface AuthContextValue {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, options?: SignUpOptions) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  resendConfirmationEmail: (email: string, returnTo?: string | null) => Promise<void>;
  resetPasswordForEmail: (email: string, returnTo?: string | null) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  handleAuthCallback: (params: AuthCallbackParams) => Promise<AuthCallbackResult>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    authService
      .getSession()
      .then((nextSession) => {
        if (!active) {
          return;
        }

        setSession(nextSession);
      })
      .catch((cause) => {
        if (!active) {
          return;
        }

        setAuthError(getErrorMessage(cause));
        setSession(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const unsubscribe = authService.onAuthStateChange((nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const next = await authService.signIn(email, password);
    setSession(next);
  }, []);

  const signUp = useCallback(async (email: string, password: string, options?: SignUpOptions) => {
    setAuthError(null);
    const result = await authService.signUp(email, password, options);
    if (result.session) {
      setSession(result.session);
    }
    return result;
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string, returnTo?: string | null) => {
    setAuthError(null);
    await authService.resendConfirmationEmail(email, returnTo);
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string, returnTo?: string | null) => {
    setAuthError(null);
    await authService.resetPasswordForEmail(email, returnTo);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setAuthError(null);
    await authService.updatePassword(password);
  }, []);

  const handleAuthCallback = useCallback(async (params: AuthCallbackParams) => {
    setAuthError(null);
    const result = await authService.handleAuthCallback(params);
    if (result.session) {
      setSession(result.session);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await authService.signOut();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    setAuthError(null);
    const next = await authService.refreshSession();
    setSession(next);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isLoading: loading,
      isAuthenticated: session !== null,
      authError,
      signIn,
      signUp,
      signOut,
      refreshSession,
      resendConfirmationEmail,
      resetPasswordForEmail,
      updatePassword,
      handleAuthCallback,
      clearAuthError,
    }),
    [
      session,
      loading,
      authError,
      signIn,
      signUp,
      signOut,
      refreshSession,
      resendConfirmationEmail,
      resetPasswordForEmail,
      updatePassword,
      handleAuthCallback,
      clearAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
