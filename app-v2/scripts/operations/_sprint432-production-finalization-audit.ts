import './bootstrap-ops-supabase';

import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import {
  measureClockSkewAgainstHttpDate,
  isJwtIssuedAtFutureError,
} from '@/services/supabase/jwt-clock-skew';
import { resolveSupabaseUrl } from '@/services/supabase/client';
import { resolveSupabaseServiceRoleKey } from '@/services/supabase/client-service-role';
import type { SourceConfigAuditSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

async function main(): Promise<void> {
  const before = await measureClockSkewAgainstHttpDate(
    fetch,
    resolveSupabaseUrl(),
    resolveSupabaseServiceRoleKey(),
  );

  let aliasStoreStatus: 'ok' | 'failed' = 'ok';
  let aliasError: string | undefined;
  try {
    await initializeEntityAliasStore();
  } catch (error) {
    aliasStoreStatus = 'failed';
    aliasError = error instanceof Error ? error.message : String(error);
  }

  const client = opsClient();
  const { data: protonSource, error: sourceError } = await client
    .from('sources')
    .select('id,source_config,metadata')
    .eq('id', 'source-ticket-io-protontheclub')
    .single();
  const protonRow = protonSource as SourceConfigAuditSnippet | null;

  const { count: lineupCount } = await client
    .from('event_artists')
    .select('*', { count: 'exact', head: true });

  const after = await measureClockSkewAgainstHttpDate(
    fetch,
    resolveSupabaseUrl(),
    resolveSupabaseServiceRoleKey(),
  );

  console.log(
    JSON.stringify(
      {
        clockSkewBefore: before,
        clockSkewAfter: after,
        aliasStore: {
          status: aliasStoreStatus,
          error: aliasError,
          jwtClockIssue: aliasError ? isJwtIssuedAtFutureError(aliasError) : false,
        },
        migrations: {
          migration710: {
            connectorVersion: (protonRow?.metadata as Record<string, unknown> | undefined)
              ?.connectorVersion,
            dataQualityRepairVersion: (
              protonRow?.metadata as Record<string, unknown> | undefined
            )?.dataQualityRepairVersion,
          },
          migration720: {
            shopSlug: (
              protonRow?.source_config as { ticketPlatform?: { shopSlug?: string } } | undefined
            )?.ticketPlatform?.shopSlug,
            listUrl: (
              protonRow?.source_config as { ticketPlatform?: { listUrl?: string } } | undefined
            )?.ticketPlatform?.listUrl,
            shopSlugRepair: (protonRow?.metadata as Record<string, unknown> | undefined)
              ?.shopSlugRepair,
          },
          sourceError: sourceError?.message,
        },
        lineupRowCount: lineupCount ?? 0,
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
