import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabase, requireSupabase } from '@/lib/supabase/client';
import { getAuthRedirectUrl } from '@/utils/authLinking';
import { ServiceResult } from './types';

export async function getCurrentSession(): Promise<ServiceResult<Session | null>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase.auth.getSession();
  if (error) return { data: null, error: error.message, offline: false };
  return { data: data.session, error: null, offline: false };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<ServiceResult<Session | null>> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error: error.message, offline: false };
    return { data: data.session, error: null, offline: false };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Sign in failed', offline: true };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<ServiceResult<{ session: Session | null; user: User | null }>> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName ?? email.split('@')[0] },
        emailRedirectTo: getAuthRedirectUrl('verify-email'),
      },
    });
    if (error) return { data: null, error: error.message, offline: false };
    return {
      data: { session: data.session, user: data.user },
      error: null,
      offline: false,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Sign up failed', offline: true };
  }
}

export async function signOutUser(): Promise<ServiceResult<void>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: error.message, offline: false };
  return { data: undefined, error: null, offline: false };
}

export async function resetPasswordForEmail(email: string): Promise<ServiceResult<void>> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('reset-password'),
    });
    if (error) return { data: null, error: error.message, offline: false };
    return { data: undefined, error: null, offline: false };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Reset failed', offline: true };
  }
}

export async function updatePassword(newPassword: string): Promise<ServiceResult<void>> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { data: null, error: error.message, offline: false };
    return { data: undefined, error: null, offline: false };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Password update failed', offline: true };
  }
}

export async function resendVerificationEmail(email: string): Promise<ServiceResult<void>> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectUrl('verify-email') },
    });
    if (error) return { data: null, error: error.message, offline: false };
    return { data: undefined, error: null, offline: false };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Verification email failed',
      offline: true,
    };
  }
}

export function isEmailVerified(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

export function subscribeToAuthChanges(
  onChange: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = supabase.auth.onAuthStateChange(onChange);
  return () => data.subscription.unsubscribe();
}
