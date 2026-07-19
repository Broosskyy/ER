-- Eternal Rave — authenticated write grants
-- RLS (is_admin()) remains authoritative for who may write.
-- Fixes: permission denied for table events on upsert/insert/update
-- when only SELECT was granted in 20260724000000_anon_authenticated_grants.sql.

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Storage: admin_upload_event_images policy requires is_admin() on insert.
GRANT INSERT ON ALL TABLES IN SCHEMA storage TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  GRANT INSERT ON TABLES TO authenticated;
