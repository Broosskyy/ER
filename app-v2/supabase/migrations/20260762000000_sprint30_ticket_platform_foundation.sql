-- Sprint 30: Generic ticket platform foundation (vocabulary only).
-- No production connectors or source rows are added in this migration.
-- Category `ticket_platform` is stored in sources.metadata->>'category' (see source-mapper).

COMMENT ON TABLE public.sources IS
  'Event acquisition sources. Admin category ticket_platform (Sprint 30) classifies ticket-shop platforms such as ticket.io, TicketKings, Eventbrite, and Resident Advisor. Existing production sources (Bootshaus, Affenkäfig) remain unchanged.';
