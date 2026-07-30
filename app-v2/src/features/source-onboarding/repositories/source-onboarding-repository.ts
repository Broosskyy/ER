import type { SourceOnboardingJob } from '@/features/source-onboarding/domain/types';

export interface SourceOnboardingRepository {
  save(job: SourceOnboardingJob): Promise<SourceOnboardingJob>;
  getById(id: string): Promise<SourceOnboardingJob | null>;
  list(): Promise<SourceOnboardingJob[]>;
  findByHostname(hostname: string): Promise<SourceOnboardingJob | null>;
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
    const normalized = hostname.toLowerCase();
    return (
      [...this.jobs.values()].find((job) => job.hostname.toLowerCase() === normalized) ?? null
    );
  }
}
