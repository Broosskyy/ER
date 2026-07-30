import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SourceRecord } from '@/data/types/records';
import {
  createBootshausTicketIoProductionSourceRecord as createBootshausTicketIoProductionSourceRecordCore,
} from '@/features/sources/production/ticket-io-source.core';

export {
  TICKET_IO_BOOTSHAUS_SOURCE_ID,
  TICKET_IO_BOOTSHAUS_SOURCE_SLUG,
  TICKET_IO_BOOTSHAUS_STABLE_KEY,
  TICKET_IO_BOOTSHAUS_SHOP_URL,
} from '@/features/sources/production/ticket-io-source.core';

const FIXTURE_PATH = join(
  __dirname,
  '../../aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);

export function loadTicketIoBootshausFixtureHtml(): string {
  return readFileSync(FIXTURE_PATH, 'utf8');
}

export function createBootshausTicketIoProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return createBootshausTicketIoProductionSourceRecordCore(overrides, {
    fixtureHtml: loadTicketIoBootshausFixtureHtml(),
  });
}
