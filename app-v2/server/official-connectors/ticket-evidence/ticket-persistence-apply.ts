import type { EventTicketPersistencePlan, TicketPersistenceWritePlanSummary } from './ticket-persistence-types';

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

export function buildTicketPersistenceApplySql(
  summary: TicketPersistenceWritePlanSummary,
  precheck: {
    events: number;
    eventTickets: number;
    eventSources: number;
  },
  postcheckTickets: number,
): string {
  const ticketBlocks: string[] = [];
  const sourceBlocks: string[] = [];
  const provenanceBlocks: string[] = [];

  for (const plan of summary.eventPlans) {
    if (plan.ticketOperation === 'insert' && plan.plannedTicketRow) {
      const row = plan.plannedTicketRow;
      ticketBlocks.push(`
    INSERT INTO public.event_tickets (
      event_id, provider, ticket_url, price_from_minor, currency, sales_status, sort_order
    )
    VALUES (
      ${sqlLiteral(plan.eventId)}::uuid,
      ${row.provider ? sqlLiteral(row.provider) : 'NULL'},
      ${row.ticketUrl ? sqlLiteral(row.ticketUrl) : 'NULL'},
      ${row.priceFromMinor != null ? String(row.priceFromMinor) : 'NULL'},
      ${row.currency ? sqlLiteral(row.currency) : 'NULL'},
      ${row.salesStatus ? sqlLiteral(row.salesStatus) : 'NULL'},
      ${row.sortOrder}
    );`);
    }

    if (plan.ticketOperation === 'update' && plan.plannedTicketRow && plan.existingTicketId) {
      const row = plan.plannedTicketRow;
      ticketBlocks.push(`
    UPDATE public.event_tickets
    SET
      provider = ${row.provider ? sqlLiteral(row.provider) : 'NULL'},
      ticket_url = ${row.ticketUrl ? sqlLiteral(row.ticketUrl) : 'NULL'},
      price_from_minor = ${row.priceFromMinor != null ? String(row.priceFromMinor) : 'NULL'},
      currency = ${row.currency ? sqlLiteral(row.currency) : 'NULL'},
      sales_status = ${row.salesStatus ? sqlLiteral(row.salesStatus) : 'NULL'},
      updated_at = now()
    WHERE id = ${sqlLiteral(plan.existingTicketId)}::uuid;`);
    }

    if (plan.ticketOperation === 'delete' && plan.existingTicketId) {
      ticketBlocks.push(`
    DELETE FROM public.event_tickets
    WHERE id = ${sqlLiteral(plan.existingTicketId)}::uuid;`);
    }

    if (plan.providerSourceOperation === 'insert' && plan.providerSourceUrl && plan.providerSourcePayload) {
      sourceBlocks.push(`
    INSERT INTO public.event_sources (
      event_id, source_role, source_url, observed_at, content_hash, raw_payload
    )
    VALUES (
      ${sqlLiteral(plan.eventId)}::uuid,
      'ticket',
      ${sqlLiteral(plan.providerSourceUrl)},
      now(),
      ${plan.providerSourcePayload.contentFingerprint ? sqlLiteral(String(plan.providerSourcePayload.contentFingerprint)) : 'NULL'},
      ${sqlJson(plan.providerSourcePayload)}
    );`);
    }

    if (
      plan.providerSourceOperation === 'update' &&
      plan.providerSourceUrl &&
      plan.providerSourcePayload
    ) {
      sourceBlocks.push(`
    UPDATE public.event_sources
    SET
      observed_at = now(),
      content_hash = ${plan.providerSourcePayload.contentFingerprint ? sqlLiteral(String(plan.providerSourcePayload.contentFingerprint)) : 'NULL'},
      raw_payload = ${sqlJson(plan.providerSourcePayload)}
    WHERE event_id = ${sqlLiteral(plan.eventId)}::uuid
      AND source_role = 'ticket'
      AND source_url = ${sqlLiteral(plan.providerSourceUrl)};`);
    }

    if (plan.provenanceOperation === 'update') {
      provenanceBlocks.push(`
    UPDATE public.event_sources
    SET raw_payload = COALESCE(raw_payload, '{}'::jsonb) || jsonb_build_object(
      'ticketEvidenceProjection',
      ${sqlJson(plan.provenancePayload)}
    )
    WHERE id = ${sqlLiteral(plan.officialSourceId)}::uuid
      AND source_role = 'official';`);
    }
  }

  return `BEGIN;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.events) <> ${precheck.events} THEN
    RAISE EXCEPTION 'M6.6 precheck failed: events';
  END IF;
  IF (SELECT COUNT(*) FROM public.event_tickets) <> ${precheck.eventTickets} THEN
    RAISE EXCEPTION 'M6.6 precheck failed: event_tickets';
  END IF;
  IF (SELECT COUNT(*) FROM public.event_sources) <> ${precheck.eventSources} THEN
    RAISE EXCEPTION 'M6.6 precheck failed: event_sources';
  END IF;
  IF (SELECT COUNT(*) FROM public.events WHERE title = 'Eternal Rave Core Test') <> 1 THEN
    RAISE EXCEPTION 'M6.6 precheck failed: m2 test event missing';
  END IF;

  ${ticketBlocks.join('\n')}
  ${sourceBlocks.join('\n')}
  ${provenanceBlocks.join('\n')}

  IF (SELECT COUNT(*) FROM public.event_tickets) <> ${postcheckTickets} THEN
    RAISE EXCEPTION 'M6.6 postcheck failed: event_tickets';
  END IF;
END $$;

COMMIT;
`;
}

export function countPlannedTicketMutations(summary: TicketPersistenceWritePlanSummary): {
  inserts: number;
  updates: number;
  deletes: number;
  postcheckTickets: number;
} {
  const inserts = summary.eventPlans.filter((plan) => plan.ticketOperation === 'insert').length;
  const updates = summary.eventPlans.filter((plan) => plan.ticketOperation === 'update').length;
  const deletes = summary.eventPlans.filter((plan) => plan.ticketOperation === 'delete').length;
  return {
    inserts,
    updates,
    deletes,
    postcheckTickets: summary.eventPlans.filter((plan) => plan.plannedTicketRow).length + 1,
  };
}
