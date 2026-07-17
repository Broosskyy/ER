import { getSupabase } from '@/lib/supabase/client';
import { ServiceResult } from './types';

export async function fetchFavoriteIds(userId: string): Promise<ServiceResult<string[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('favorites')
    .select('event_id')
    .eq('user_id', userId);

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []).map((row: { event_id: string }) => row.event_id), error: null, offline: false };
}

export async function addFavorite(userId: string, eventId: string): Promise<ServiceResult<void>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { error } = await supabase.from('favorites').upsert({ user_id: userId, event_id: eventId });
  if (error) return { data: null, error: error.message, offline: false };
  return { data: undefined, error: null, offline: false };
}

export async function removeFavorite(userId: string, eventId: string): Promise<ServiceResult<void>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('event_id', eventId);
  if (error) return { data: null, error: error.message, offline: false };
  return { data: undefined, error: null, offline: false };
}
