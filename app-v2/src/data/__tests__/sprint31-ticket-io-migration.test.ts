import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { SOURCE_CONNECTOR_KEYS } from '@/features/aggregation/connectors/types';
import { canResolveSourceConnector } from '@/features/aggregation/connectors/source-connector-resolution';
import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260763000000_sprint31_ticket_io_production.sql',
);

describe('Sprint 31 ticket.io production migration', () => {
  it('registers ticket_platform connector key', () => {
    expect(SOURCE_CONNECTOR_KEYS).toContain('ticket_platform');
  });

  it('seeds bootshaus ticket.io source with scheduler', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('source-bootshaus-ticket-io');
    expect(sql).toContain('manual_review');
    expect(sql).toContain('every_6_hours');
  });

  it('factory source resolves connector', () => {
    expect(canResolveSourceConnector(createBootshausTicketIoProductionSourceRecord())).toBe(true);
  });
});
