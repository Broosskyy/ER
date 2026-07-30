import type {
  PlatformDiscoveryCandidate,
  PlatformDiscoveryReport,
  PlatformDiscoveryRun,
} from '@/features/ticket-platform-discovery/domain/types';

export interface PlatformDiscoveryRepository {
  saveRun(run: PlatformDiscoveryRun): Promise<PlatformDiscoveryRun>;
  getRunById(id: string): Promise<PlatformDiscoveryRun | null>;
  listRuns(platform?: string): Promise<PlatformDiscoveryRun[]>;
  saveCandidate(candidate: PlatformDiscoveryCandidate): Promise<PlatformDiscoveryCandidate>;
  listCandidatesByRun(runId: string): Promise<PlatformDiscoveryCandidate[]>;
  getCandidateById(id: string): Promise<PlatformDiscoveryCandidate | null>;
  updateCandidateStatus(
    id: string,
    status: PlatformDiscoveryCandidate['status'],
    duplicateSourceId?: string,
  ): Promise<PlatformDiscoveryCandidate>;
}

export class InMemoryPlatformDiscoveryRepository implements PlatformDiscoveryRepository {
  private readonly runs = new Map<string, PlatformDiscoveryRun>();
  private readonly candidates = new Map<string, PlatformDiscoveryCandidate>();

  async saveRun(run: PlatformDiscoveryRun): Promise<PlatformDiscoveryRun> {
    this.runs.set(run.id, run);
    return run;
  }

  async getRunById(id: string): Promise<PlatformDiscoveryRun | null> {
    return this.runs.get(id) ?? null;
  }

  async listRuns(platform?: string): Promise<PlatformDiscoveryRun[]> {
    return [...this.runs.values()]
      .filter((run) => !platform || run.platform === platform)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveCandidate(candidate: PlatformDiscoveryCandidate): Promise<PlatformDiscoveryCandidate> {
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async listCandidatesByRun(runId: string): Promise<PlatformDiscoveryCandidate[]> {
    return [...this.candidates.values()].filter((candidate) => candidate.runId === runId);
  }

  async getCandidateById(id: string): Promise<PlatformDiscoveryCandidate | null> {
    return this.candidates.get(id) ?? null;
  }

  async updateCandidateStatus(
    id: string,
    status: PlatformDiscoveryCandidate['status'],
    duplicateSourceId?: string,
  ): Promise<PlatformDiscoveryCandidate> {
    const existing = this.candidates.get(id);
    if (!existing) {
      throw new Error(`Discovery candidate ${id} not found.`);
    }
    const updated = {
      ...existing,
      status,
      duplicateSourceId: duplicateSourceId ?? existing.duplicateSourceId,
      updatedAt: new Date().toISOString(),
    };
    this.candidates.set(id, updated);
    return updated;
  }
}

export async function loadDiscoveryReport(
  repository: PlatformDiscoveryRepository,
  runId: string,
): Promise<PlatformDiscoveryReport | null> {
  const run = await repository.getRunById(runId);
  if (!run) {
    return null;
  }
  const candidates = await repository.listCandidatesByRun(runId);
  return { run, candidates };
}
