BEGIN;

-- event_sources holds internal evidence (including raw_payload) and must not be
-- readable by mobile or anonymous Supabase clients.
DROP POLICY IF EXISTS event_sources_select_published_event ON public.event_sources;

REVOKE SELECT ON public.event_sources FROM anon, authenticated;

COMMIT;
