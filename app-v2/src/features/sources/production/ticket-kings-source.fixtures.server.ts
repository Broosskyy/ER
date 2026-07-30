import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SourceRecord } from '@/data/types/records';
import {
  createAffenkaefigTicketKingsProductionSourceRecord as createAffenkaefigTicketKingsProductionSourceRecordCore,
} from '@/features/sources/production/ticket-kings-source.core';

export {
  TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
  TICKET_KINGS_AFFENKAEFIG_SOURCE_SLUG,
  TICKET_KINGS_AFFENKAEFIG_STABLE_KEY,
  TICKET_KINGS_EVENTS_LIST_URL,
} from '@/features/sources/production/ticket-kings-source.core';

const FIXTURE_PATH = join(
  __dirname,
  '../../aggregation/connectors/ticket-platform/fixtures/ticket-kings-affenkaefig-events.html',
);

export function loadTicketKingsAffenkaefigFixtureHtml(): string {
  return readFileSync(FIXTURE_PATH, 'utf8');
}

export function createAffenkaefigTicketKingsProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return createAffenkaefigTicketKingsProductionSourceRecordCore(overrides, {
    fixtureHtml: loadTicketKingsAffenkaefigFixtureHtml(),
  });
}
