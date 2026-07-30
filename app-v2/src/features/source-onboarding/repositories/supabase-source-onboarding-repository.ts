import {
  getRawSupabaseClient,
  resultOrThrow,
} from '@/data/supabase/supabase-query-client';
import type {
  SourceOnboardingJob,
  SourceOnboardingStatus,
} from '@/features/source-onboarding/domain/types';
import { assertOnboardingStatusTransition } from '@/features/source-onboarding/domain/status-transitions';
import type { SourceOnboardingRepository } from '@/features/source-onboarding/repositories/source-onboarding-repository';

function mapRow(row: Record<string, unknown>): SourceOnboardingJob {
  return {
    id: String(row.id),
    submittedUrl: String(row.submitted_url),
    normalizedUrl: String(row.normalized_url),
    hostname: String(row.hostname),
    status: row.status as SourceOnboardingStatus,
    detectedPlatform: row.detected_platform ? String(row.detected_platform) : undefined,
    detectedFramework: row.detected_framework ? String(row.detected_framework) : undefined,
    detectedSourceType: row.detected_source_type ? String(row.detected_source_type) : undefined,
    confidence: Number(row.confidence ?? 0),
    discoveryResult: row.discovery_result as SourceOnboardingJob['discoveryResult'],
    generatedConfig: row.generated_config as SourceOnboardingJob['generatedConfig'],
    validationResult: row.validation_result as SourceOnboardingJob['validationResult'],
    dryRunReport: row.dry_run_report as SourceOnboardingJob['dryRunReport'],
    reviewNotes: row.review_notes ? String(row.review_notes) : undefined,
    duplicateSourceId: row.duplicate_source_id ? String(row.duplicate_source_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toRow(job: SourceOnboardingJob): Record<string, unknown> {
  return {
    id: job.id,
    submitted_url: job.submittedUrl,
    normalized_url: job.normalizedUrl,
    hostname: job.hostname,
    status: job.status,
    detected_platform: job.detectedPlatform ?? null,
    detected_framework: job.detectedFramework ?? null,
    detected_source_type: job.detectedSourceType ?? null,
    confidence: job.confidence,
    discovery_result: job.discoveryResult ?? null,
    generated_config: job.generatedConfig ?? null,
    validation_result: job.validationResult ?? null,
    dry_run_report: job.dryRunReport ?? null,
    review_notes: job.reviewNotes ?? null,
    duplicate_source_id: job.duplicateSourceId ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export class SupabaseSourceOnboardingRepository implements SourceOnboardingRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async save(job: SourceOnboardingJob): Promise<SourceOnboardingJob> {
    const existing = await this.getById(job.id);
    if (existing) {
      assertOnboardingStatusTransition(existing.status, job.status);
    }
    const result = await this.client()
      .from('source_onboarding_jobs')
      .upsert(toRow(job), { onConflict: 'id' });
    resultOrThrow(result);
    const saved = await this.getById(job.id);
    if (!saved) {
      throw new Error(`Failed to persist onboarding job ${job.id}.`);
    }
    return saved;
  }

  async getById(id: string): Promise<SourceOnboardingJob | null> {
    const result = await this.client().from('source_onboarding_jobs').select('*').eq('id', id).maybeSingle();
    const data = resultOrThrow(result);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async list(): Promise<SourceOnboardingJob[]> {
    const result = await this.client()
      .from('source_onboarding_jobs')
      .select('*')
      .order('updated_at', { ascending: false });
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapRow);
  }

  async findByHostname(hostname: string): Promise<SourceOnboardingJob | null> {
    const normalized = hostname.toLowerCase().replace(/^www\./, '');
    const result = await this.client()
      .from('source_onboarding_jobs')
      .select('*')
      .eq('hostname', normalized)
      .order('updated_at', { ascending: false });
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByNormalizedUrl(normalizedUrl: string): Promise<SourceOnboardingJob | null> {
    const result = await this.client()
      .from('source_onboarding_jobs')
      .select('*')
      .eq('normalized_url', normalizedUrl)
      .order('updated_at', { ascending: false });
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async updateStatus(id: string, status: SourceOnboardingStatus): Promise<SourceOnboardingJob> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Onboarding job ${id} not found.`);
    }
    assertOnboardingStatusTransition(existing.status, status);
    return this.save({ ...existing, status, updatedAt: new Date().toISOString() });
  }
}
