/**
 * Diagnose single Bootshaus publish failure.
 */
import './bootstrap-ops-supabase';

import { adminSourceRepository, importEventPublishService, importRecordRepository } from '@/data/repositories/registry';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';

const BOOTSHAUS = 'source-bootshaus-koeln';

async function main() {
  await initializeEntityAliasStore();
  const source = await adminSourceRepository.getById(BOOTSHAUS);
  if (!source) throw new Error('source missing');
  const records = await importRecordRepository.listLatestBySourceId(BOOTSHAUS);
  const record = records.find((entry) => entry.status !== 'imported') ?? records[0];
  if (!record) throw new Error('no records');
  try {
    const result = await importEventPublishService.publishRecord(record, source, records, {
      actorId: 'diag',
    });
    console.log('SUCCESS', result.event.id, result.event.title);
  } catch (error) {
    console.error('FAIL', error);
  }
}

main();
