import { randomUUID } from 'node:crypto';

import {
  buildOfficialEventApplySql,
  buildOfficialEventApplySummary,
  isOfficialEventApplyNoop,
  type OfficialEventApplyPrecondition,
} from '../planning/event-apply';
import type { EventWritePlan } from '../types/event-candidate';
import type { ApplyExecutionResult } from './types';
import type { LinkedQueryExecutor } from './linked-db';
import { loadJsonAgg } from './linked-db';

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function loadApplyPrecondition(
  runQuery: LinkedQueryExecutor,
  plan: EventWritePlan,
): OfficialEventApplyPrecondition {
  const eventId = plan.resolvedEventId ?? plan.existingSource?.eventId;
  if (!eventId) {
    return {};
  }

  const rows = loadJsonAgg<{
    description: string | null;
    sourceContentHash: string | null;
    sourceId: string | null;
    lineupBillingNames: string[];
    genreDisplayNames: string[];
  }>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'description', e.description,
        'sourceContentHash', s.content_hash,
        'sourceId', s.id,
        'lineupBillingNames', (
          SELECT COALESCE(jsonb_agg(l.billing_name ORDER BY l.sort_order), '[]'::jsonb)
          FROM public.event_lineup l
          WHERE l.event_id = e.id
        ),
        'genreDisplayNames', (
          SELECT COALESCE(jsonb_agg(g.display_name ORDER BY g.sort_order), '[]'::jsonb)
          FROM public.event_genres g
          WHERE g.event_id = e.id
        )
      )
    ) AS rows
    FROM public.events e
    LEFT JOIN public.event_sources s
      ON s.event_id = e.id
      AND s.source_role = 'official'
      AND s.source_url = ${sqlLiteral(plan.sourceIdentity.sourceUrl)}
    WHERE e.id = ${sqlLiteral(eventId)}::uuid;
  `,
  );

  const row = rows[0];
  if (!row) {
    return { eventId };
  }

  return {
    eventId,
    sourceId: row.sourceId ?? plan.existingSource?.sourceId,
    description: row.description,
    sourceContentHash: row.sourceContentHash,
    lineupBillingNames: row.lineupBillingNames ?? [],
    genreDisplayNames: row.genreDisplayNames ?? [],
  };
}

export function createOfficialEventApplyExecutor(runQuery: LinkedQueryExecutor) {
  return async (plan: EventWritePlan): Promise<ApplyExecutionResult> => {
    if (isOfficialEventApplyNoop(plan)) {
      return {
        applied: false,
        logicalOperations: 0,
        databaseRowsInserted: 0,
        databaseRowsUpdated: 0,
        databaseRowsDeleted: 0,
        ticketRowsChanged: 0,
      };
    }

    const eventId = plan.resolvedEventId ?? plan.existingSource?.eventId ?? randomUUID();
    const sourceId = plan.existingSource?.sourceId ?? randomUUID();
    const venueId =
      plan.existingVenueId ?? (plan.venueAction === 'insert' ? randomUUID() : undefined);

    const ids = { eventId, sourceId, venueId };
    const precondition = loadApplyPrecondition(runQuery, plan);
    const summary = buildOfficialEventApplySummary(plan, ids);
    const sql = buildOfficialEventApplySql(plan, ids, precondition);
    runQuery(sql);

    return {
      applied: summary.logicalOperations > 0,
      logicalOperations: summary.logicalOperations,
      databaseRowsInserted: summary.databaseRowsInserted,
      databaseRowsUpdated: summary.databaseRowsUpdated,
      databaseRowsDeleted: summary.databaseRowsDeleted,
      ticketRowsChanged: 0,
    };
  };
}
