BEGIN;

-- Remove legacy application objects in public. Auth, storage infra, vault and
-- extensions schemas are not dropped. Auth users are not deleted.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
COMMENT ON SCHEMA public IS 'Eternal Rave event-core baseline';

ALTER SCHEMA public OWNER TO postgres;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, service_role;

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  address_line text,
  postal_code text,
  city text,
  country_code text,
  latitude double precision,
  longitude double precision,
  official_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('draft', 'review', 'published', 'cancelled', 'archived')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  image_url text,
  official_url text,
  venue_id uuid REFERENCES public.venues (id) ON DELETE RESTRICT,
  organizer_name text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_ends_at_after_starts_at
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT events_published_requires_published_at
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE public.event_lineup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  billing_name text NOT NULL CHECK (length(btrim(billing_name)) > 0),
  billing_role text NOT NULL CHECK (billing_role IN ('artist', 'headliner', 'compound_act')),
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_lineup_event_sort_unique UNIQUE (event_id, sort_order)
);

COMMENT ON TABLE public.event_lineup IS
  'One billing act equals exactly one row. Names containing &, x, b2b or vs. are never split.';

CREATE TABLE public.event_genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  genre_key text NOT NULL CHECK (length(btrim(genre_key)) > 0),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  raw_label text,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_genres_event_key_unique UNIQUE (event_id, genre_key),
  CONSTRAINT event_genres_event_sort_unique UNIQUE (event_id, sort_order)
);

CREATE TABLE public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  provider text,
  ticket_url text,
  price_from_minor integer CHECK (price_from_minor IS NULL OR price_from_minor >= 0),
  currency text,
  sales_status text,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_tickets_event_sort_unique UNIQUE (event_id, sort_order)
);

CREATE TABLE public.event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  source_role text NOT NULL CHECK (source_role IN ('official', 'ticket', 'media', 'manual')),
  source_url text,
  observed_at timestamptz,
  verified_at timestamptz,
  content_hash text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_sources_event_role_url_unique UNIQUE (event_id, source_role, source_url)
);

CREATE INDEX events_status_idx ON public.events (status);
CREATE INDEX events_starts_at_idx ON public.events (starts_at);
CREATE INDEX events_venue_id_idx ON public.events (venue_id);
CREATE INDEX events_created_by_idx ON public.events (created_by);
CREATE INDEX event_lineup_event_id_sort_idx ON public.event_lineup (event_id, sort_order);
CREATE INDEX event_genres_event_id_sort_idx ON public.event_genres (event_id, sort_order);
CREATE INDEX event_tickets_event_id_sort_idx ON public.event_tickets (event_id, sort_order);
CREATE INDEX event_sources_event_id_idx ON public.event_sources (event_id);
CREATE INDEX event_sources_source_role_idx ON public.event_sources (source_role);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_lineup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select_published
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY venues_select_published_event
  ON public.venues
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.venue_id = venues.id
        AND e.status = 'published'
    )
  );

CREATE POLICY event_lineup_select_published_event
  ON public.event_lineup
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_lineup.event_id
        AND e.status = 'published'
    )
  );

CREATE POLICY event_genres_select_published_event
  ON public.event_genres
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_genres.event_id
        AND e.status = 'published'
    )
  );

CREATE POLICY event_tickets_select_published_event
  ON public.event_tickets
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_tickets.event_id
        AND e.status = 'published'
    )
  );

CREATE POLICY event_sources_select_published_event
  ON public.event_sources
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_sources.event_id
        AND e.status = 'published'
    )
  );

GRANT SELECT ON
  public.venues,
  public.events,
  public.event_lineup,
  public.event_genres,
  public.event_tickets,
  public.event_sources
TO anon, authenticated;

GRANT ALL ON
  public.venues,
  public.events,
  public.event_lineup,
  public.event_genres,
  public.event_tickets,
  public.event_sources
TO postgres, service_role;

COMMIT;
