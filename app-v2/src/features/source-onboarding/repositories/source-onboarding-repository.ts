import type {
  SourceOnboardingJob,
  SourceOnboardingStatus,
} from '@/features/source-onboarding/domain/types';

export interface SourceOnboardingRepository {
  save(job: SourceOnboardingJob): Promise<SourceOnboardingJob>;
  getById(id: string): Promise<SourceOnboardingJob | null>;
  list(): Promise<SourceOnboardingJob[]>;
  findByHostname(hostname: string): Promise<SourceOnboardingJob | null>;
  findByNormalizedUrl(normalizedUrl: string): Promise<SourceOnboardingJob | null>;
  updateStatus(id: string, status: SourceOnboardingStatus): Promise<SourceOnboardingJob>;
}

export class InMemorySourceOnboardingRepository implements SourceOnboardingRepository {
  private readonly jobs = new Map<string, SourceOnboardingJob>();

  async save(job: SourceOnboardingJob): Promise<SourceOnboardingJob> {
    this.jobs.set(job.id, { ...job });
    return job;
  }

  async getById(id: string): Promise<SourceOnboardingJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async list(): Promise<SourceOnboardingJob[]> {
    return [...this.jobs.values()];
  }

  async findByHostname(hostname: string): Promise<SourceOnboardingJob | null> {
    const normalized = hostname.toLowerCase().replace(/^www\./, '');
    return (
      [...this.jobs.values()].find(
        (job) => job.hostname.toLowerCase().replace(/^www\./, '') === normalized,
      ) ?? null
    );
  }

  async findByNormalizedUrl(normalizedUrl: string): Promise<SourceOnboardingJob | null> {
    return [...this.jobs.values()].find((job) => job.normalizedUrl === normalizedUrl) ?? null;
  }

  async updateStatus(id: string, status: SourceOnboardingStatus): Promise<SourceOnboardingJob> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Onboarding job ${id} not found.`);
    }
    return this.save({ ...existing, status, updatedAt: new Date().toISOString() });
  }
}
