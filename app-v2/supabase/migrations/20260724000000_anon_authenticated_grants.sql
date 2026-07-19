-- Grant base table privileges to Supabase API roles.
-- RLS policies (unchanged) enforce row-level access on top of these grants.
-- Without USAGE + SELECT, anon/authenticated queries fail with 42501 before RLS runs.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;
