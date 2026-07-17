import { getSupabase } from '@/lib/supabase/client';
import { OrganizerRow } from '@/types/database';
import { ServiceResult } from './types';

export async function fetchOrganizerForProfile(
  profileId: string
): Promise<ServiceResult<OrganizerRow | null>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('organizers')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data as OrganizerRow | null) ?? null, error: null, offline: false };
}
