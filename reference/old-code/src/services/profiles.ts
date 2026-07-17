import { getSupabase } from '@/lib/supabase/client';
import { ProfileRow } from '@/types/database';
import { ServiceResult } from './types';

export async function fetchProfile(userId: string): Promise<ServiceResult<ProfileRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data as ProfileRow | null), error: null, offline: false };
}

export async function updateProfileRole(
  userId: string,
  role: ProfileRow['role']
): Promise<ServiceResult<ProfileRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: data as ProfileRow, error: null, offline: false };
}

export async function fetchReportCount(): Promise<ServiceResult<number>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { count, error } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  if (error) return { data: null, error: error.message, offline: false };
  return { data: count ?? 0, error: null, offline: false };
}
