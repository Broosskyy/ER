-- Sprint 43 / Phase 4.3: Ticket.io data quality — persist consumer price labels.

alter table public.events
  add column if not exists price_text text;

comment on column public.events.price_text is
  'Consumer-facing ticket price label (e.g. ab 12,00 €, Ausverkauft).';
