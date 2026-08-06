/**
 * Apply Sprint 43.1 production fixes before repair:
 * - correct Proton shop slug
 * - republish archived Proton events after accidental empty-fetch archive
 */
import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_sprint431-apply-production-fixes.ts');

import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import type { EventArchivedSnippet, SourceConfigOnlySnippet } from './ops-supabase-rows';
import { updateEventRow, updateSourceRow } from './ops-supabase-rows';

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();

  const { data: source, error: readError } = await client
    .from('sources')
    .select('source_config')
    .eq('id', 'source-ticket-io-protontheclub')
    .single();

  if (readError) {
    throw new Error(readError.message);
  }

  const sourceRow = source as SourceConfigOnlySnippet | null;
  const existingConfig = (sourceRow?.source_config ?? {}) as Record<string, unknown>;
  const ticketPlatform = {
    ...((existingConfig.ticketPlatform as Record<string, unknown> | undefined) ?? {}),
    platform: 'ticket_io',
    shopSlug: 'proton-the-club',
    listUrl: 'https://proton-the-club.ticket.io/',
  };

  await updateSourceRow('source-ticket-io-protontheclub', {
    source_config: {
      ...existingConfig,
      ticketPlatform,
    } as SourceConfigOnlySnippet['source_config'],
  });

  const { data: archived, error: archivedError } = await client
    .from('events')
    .select('id,title,status')
    .eq('source_id', 'source-ticket-io-protontheclub')
    .eq('status', 'archived');

  if (archivedError) {
    throw new Error(archivedError.message);
  }

  const archivedRows = (archived ?? []) as EventArchivedSnippet[];
  const restored: string[] = [];
  for (const event of archivedRows) {
    await updateEventRow(event.id, { status: 'published' });
    restored.push(event.id);
  }

  console.log(
    JSON.stringify(
      {
        protonShopSlug: 'proton-the-club',
        restoredArchivedCount: restored.length,
        restoredEventIds: restored,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
