import { AppError } from '@/core/errors/app-error';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import { canManageSources } from '@/features/admin/admin-permissions';

import {
  generateDeclarativeSourceConfig,
  validateDeclarativeSourceConfig,
} from '@/features/source-onboarding/config/config-generator';
import type {
  SourceDiscoverRequest,
  SourceDiscoverResponse,
  SourceOnboardingJob,
} from '@/features/source-onboarding/domain/types';
import { runSourceDiscovery } from '@/features/source-onboarding/discovery/source-discovery-engine';
import { runSourceOnboardingDryRun } from '@/features/source-onboarding/dry-run/source-onboarding-dry-run';
import type { SourceOnboardingRepository } from '@/features/source-onboarding/repositories/source-onboarding-repository';
import {
  isDuplicateOnboardingHostname,
  normalizeSubmittedSourceUrl,
} from '@/features/source-onboarding/security/url-normalizer';

function createJobId(): string {
  return `onboarding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertCanDiscover(role: AdminRole | null): void {
  if (!canManageSources(role)) {
    throw new AppError('You do not have permission to discover sources.', { code: 'UNAUTHORIZED' });
  }
}

export class SourceOnboardingService {
  constructor(
    private readonly repository: SourceOnboardingRepository,
    private readonly existingHostnames: () => Promise<string[]>,
  ) {}

  async discoverFromUrl(
    role: AdminRole | null,
    request: SourceDiscoverRequest,
  ): Promise<SourceDiscoverResponse> {
    assertCanDiscover(role);

    const normalized = normalizeSubmittedSourceUrl(request.url);
    const duplicateHostname = isDuplicateOnboardingHostname(
      normalized.hostname,
      await this.existingHostnames(),
    );

    const now = new Date().toISOString();
    let job: SourceOnboardingJob = {
      id: createJobId(),
      submittedUrl: request.url,
      normalizedUrl: normalized.normalized,
      hostname: normalized.hostname,
      status: 'submitted',
      confidence: 0,
      createdAt: now,
      updatedAt: now,
      duplicateSourceId: duplicateHostname,
    };

    if (duplicateHostname) {
      job = {
        ...job,
        status: 'review_required',
        reviewNotes: `Hostname already registered: ${duplicateHostname}`,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.save(job);
      return { job };
    }

    job = { ...job, status: 'probing', updatedAt: new Date().toISOString() };
    await this.repository.save(job);

    const discovery = await runSourceDiscovery({
      url: normalized.normalized,
      hostname: normalized.hostname,
    });

    job = {
      ...job,
      status: 'discovered',
      confidence: discovery.confidence,
      detectedPlatform: discovery.detectedPlatform,
      detectedFramework: discovery.detectedFramework,
      detectedSourceType: discovery.detectedSourceType,
      discoveryResult: {
        steps: discovery.steps,
        warnings: discovery.warnings,
      },
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save(job);

    const generatedConfig = generateDeclarativeSourceConfig({
      listUrl: normalized.normalized,
      discovery,
    });
    const validationResult = validateDeclarativeSourceConfig(generatedConfig);

    job = {
      ...job,
      status: 'config_generated',
      generatedConfig,
      validationResult,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save(job);

    const dryRunReport = runSourceOnboardingDryRun({ discovery });
    const finalStatus =
      dryRunReport.risks.length > 0 || discovery.confidence < 0.65
        ? 'review_required'
        : 'ready';

    job = {
      ...job,
      status: 'dry_run',
      dryRunReport,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save(job);

    job = {
      ...job,
      status: finalStatus,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save(job);

    return { job };
  }

  async getJob(role: AdminRole | null, id: string): Promise<SourceOnboardingJob | null> {
    assertCanDiscover(role);
    return this.repository.getById(id);
  }
}
