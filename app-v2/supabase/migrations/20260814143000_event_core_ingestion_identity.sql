BEGIN;

-- events.image_url already exists on the event-core baseline.
-- Enforce HTTPS-only public image URLs for persisted events.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_image_url_https;

ALTER TABLE public.events
  ADD CONSTRAINT events_image_url_https
  CHECK (image_url IS NULL OR image_url ~ '^https://');

-- Ensure one canonical official source identity per role + URL across events.
CREATE UNIQUE INDEX IF NOT EXISTS event_sources_role_url_identity_idx
  ON public.event_sources (source_role, source_url)
  WHERE source_url IS NOT NULL;

COMMIT;
