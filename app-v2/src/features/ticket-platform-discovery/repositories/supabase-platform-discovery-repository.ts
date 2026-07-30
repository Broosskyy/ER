import {
  getRawSupabaseClient,
  resultOrThrow,
} from '@/data/supabase/supabase-query-client';
import type {
  PlatformDiscoveryCandidate,
  PlatformDiscoveryRun,
  PlatformDiscoveryRunSummary,
} from '@/features/ticket-platform-discovery/domain/types';
import type { PlatformDiscoveryRepository } from '@/features/ticket-platform-discovery/repositories/platform-discovery-repository';

function mapRunRow(row: Record<string, unknown>): PlatformDiscoveryRun {
  return {
    id: String(row.id),
    platform: row.platform as PlatformDiscoveryRun['platform'],
    status: row.status as PlatformDiscoveryRun['status'],
    summary: (row.summary ?? {}) as PlatformDiscoveryRunSummary,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCandidateRow(row: Record<string, unknown>): PlatformDiscoveryCandidate {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    platform: row.platform as PlatformDiscoveryCandidate['platform'],
    candidateType: row.candidate_type as PlatformDiscoveryCandidate['candidateType'],
    identifier: String(row.identifier),
    displayName: String(row.display_name),
    listUrl: row.list_url ? String(row.list_url) : undefined,
    proposedSourceConfig: row.proposed_source_config as PlatformDiscoveryCandidate['proposedSourceConfig'],
    discoveryStats: row.discovery_stats as PlatformDiscoveryCandidate['discoveryStats'],
    status: row.status as PlatformDiscoveryCandidate['status'],
    duplicateSourceId: row.duplicate_source_id ? String(row.duplicate_source_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function runToRow(run: PlatformDiscoveryRun): Record<string, unknown> {
  return {
    id: run.id,
    platform: run.platform,
    status: run.status,
    summary: run.summary,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  };
}

function candidateToRow(candidate: PlatformDiscoveryCandidate): Record<string, unknown> {
  return {
    id: candidate.id,
    run_id: candidate.runId,
    platform: candidate.platform,
    candidate_type: candidate.candidateType,
    identifier: candidate.identifier,
    display_name: candidate.displayName,
    list_url: candidate.listUrl ?? null,
    proposed_source_config: candidate.proposedSourceConfig ?? null,
    discovery_stats: candidate.discoveryStats ?? null,
    status: candidate.status,
    duplicate_source_id: candidate.duplicateSourceId ?? null,
    created_at: candidate.createdAt,
    updated_at: candidate.updatedAt,
  };
}

export class SupabasePlatformDiscoveryRepository implements PlatformDiscoveryRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async saveRun(run: PlatformDiscoveryRun): Promise<PlatformDiscoveryRun> {
    const result = await this.client()
      .from('platform_discovery_runs')
      .upsert(runToRow(run), { onConflict: 'id' });
    resultOrThrow(result);
    const saved = await this.getRunById(run.id);
    if (!saved) {
      throw new Error(`Failed to persist platform discovery run ${run.id}.`);
    }
    return saved;
  }

  async getRunById(id: string): Promise<PlatformDiscoveryRun | null> {
    const result = await this.client()
      .from('platform_discovery_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const data = resultOrThrow(result);
    return data ? mapRunRow(data as Record<string, unknown>) : null;
  }

  async listRuns(platform?: string): Promise<PlatformDiscoveryRun[]> {
    let query = this.client().from('platform_discovery_runs').select('*');
    if (platform) {
      query = query.eq('platform', platform);
    }
    const result = await query.order('created_at', { ascending: false });
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapRunRow);
  }

  async saveCandidate(candidate: PlatformDiscoveryCandidate): Promise<PlatformDiscoveryCandidate> {
    const result = await this.client()
      .from('platform_discovery_candidates')
      .upsert(candidateToRow(candidate), { onConflict: 'id' });
    resultOrThrow(result);
    const saved = await this.getCandidateById(candidate.id);
    if (!saved) {
      throw new Error(`Failed to persist platform discovery candidate ${candidate.id}.`);
    }
    return saved;
  }

  async listCandidatesByRun(runId: string): Promise<PlatformDiscoveryCandidate[]> {
    const result = await this.client()
      .from('platform_discovery_candidates')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapCandidateRow);
  }

  async getCandidateById(id: string): Promise<PlatformDiscoveryCandidate | null> {
    const result = await this.client()
      .from('platform_discovery_candidates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const data = resultOrThrow(result);
    return data ? mapCandidateRow(data as Record<string, unknown>) : null;
  }

  async updateCandidateStatus(
    id: string,
    status: PlatformDiscoveryCandidate['status'],
    duplicateSourceId?: string,
  ): Promise<PlatformDiscoveryCandidate> {
    const existing = await this.getCandidateById(id);
    if (!existing) {
      throw new Error(`Discovery candidate ${id} not found.`);
    }
    return this.saveCandidate({
      ...existing,
      status,
      duplicateSourceId: duplicateSourceId ?? existing.duplicateSourceId,
      updatedAt: new Date().toISOString(),
    });
  }
}
