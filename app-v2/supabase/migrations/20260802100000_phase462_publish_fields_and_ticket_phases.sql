-- Phase 4.6.2 — Publish mapper fields and structured ticket phases (additive only).
-- Deploy separately before controlled re-import.

alter table public.events
  add column if not exists venue_address text,
  add column if not exists venue_postal_code text,
  add column if not exists venue_country_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists age_restriction text,
  add column if not exists ticket_status text,
  add column if not exists ticket_phases jsonb,
  add column if not exists genre_labels jsonb;

comment on column public.events.venue_address is
  'Denormalized venue street address when no canonical venue entity is linked.';
comment on column public.events.venue_postal_code is
  'Denormalized postal code for event geography.';
comment on column public.events.venue_country_code is
  'ISO country code for denormalized event geography.';
comment on column public.events.latitude is
  'Event-specific coordinates (external / temporary venues without venue_id).';
comment on column public.events.longitude is
  'Event-specific coordinates (external / temporary venues without venue_id).';
comment on column public.events.age_restriction is
  'Consumer-facing minimum age label, e.g. ab 18 Jahren.';
comment on column public.events.ticket_status is
  'Ticket availability: not_configured | external_link | on_sale | sold_out | sales_ended.';
comment on column public.events.ticket_phases is
  'Structured ticket offers/phases for consumer Event Detail.';
comment on column public.events.genre_labels is
  'Denormalized genre labels when canonical genre_id is insufficient.';
