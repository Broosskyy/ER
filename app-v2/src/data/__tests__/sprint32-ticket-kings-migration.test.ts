import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { canResolveSourceConnector } from '@/features/aggregation/connectors/source-connector-resolution';
import { listTicketPlatformAdapters } from '@/features/aggregation/connectors/ticket-platform/adapter-registry';
import { createAffenkaefigTicketKingsProductionSourceRecord } from '@/features/sources/production/ticket-kings-source';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260764000000_sprint32_ticket_kings_production.sql',
);

describe('Sprint 32 ticket kings production migration', () => {
  it('registers ticket_king adapter alongside ticket_io', () => {
    const platforms = listTicketPlatformAdapters().map((adapter) => adapter.platformId);
    expect(platforms).toContain('ticket_io');
    expect(platforms).toContain('ticket_king');
  });

  it('seeds affenkaefig ticket kings source with scheduler', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('source-affenkaefig-ticket-kings');
    expect(sql).toContain('ticket_king');
    expect(sql).toContain('manual_review');
    expect(sql).toContain('every_6_hours');
    expect(sql).not.toContain('source-bootshaus-ticket-io');
  });

  it('factory source resolves connector', () => {
    expect(canResolveSourceConnector(createAffenkaefigTicketKingsProductionSourceRecord())).toBe(
      true,
    );
  });
});
