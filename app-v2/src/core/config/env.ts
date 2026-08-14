/**
 * Environment configuration — no secrets in code.
 * All values come from EXPO_PUBLIC_* env vars at build time.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  useSupabase: process.env.EXPO_PUBLIC_USE_SUPABASE === 'true',
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}
