import type {
  ImportJob,
  ImportJobListParams,
  ImportLog,
  ImportLogListParams,
  ImportMonitoringStats,
  ImportRecord,
  ImportRecordListParams,
  ImportRecordSummary,
} from '@/features/import/models/types';
import type { PaginatedResult } from '@/data/types/records';
import {
  computeMatchConfidence,
  mapImportRecordToSummary,
} from '@/data/mappers/import-mapper';
import type { LocalImportStore } from './local-import-datasource';

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

function jobDurationMs(job: ImportJob): number {
  if (!job.startedAt || !job.finishedAt) return 0;
  return new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
}

export function listJobsLocal(
  store: LocalImportStore,
  params: ImportJobListParams,
): PaginatedResult<ImportJob> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  let jobs = [...store.jobs];

  if (params.sourceId) {
    jobs = jobs.filter((job) => job.sourceId === params.sourceId);
  }
  if (params.status && params.status !== 'all') {
    jobs = jobs.filter((job) => job.status === params.status);
  }
  if (params.triggerType && params.triggerType !== 'all') {
    jobs = jobs.filter((job) => job.triggerType === params.triggerType);
  }
  if (params.fromDate) {
    const from = new Date(params.fromDate).getTime();
    jobs = jobs.filter((job) => new Date(job.createdAt).getTime() >= from);
  }
  if (params.toDate) {
    const to = new Date(params.toDate).getTime();
    jobs = jobs.filter((job) => new Date(job.createdAt).getTime() <= to);
  }
  if (params.errorsOnly) {
    jobs = jobs.filter(
      (job) =>
        job.status === 'failed' ||
        job.metrics.errorCount > 0 ||
        job.metrics.invalidCount > 0,
    );
  }

  switch (params.sortBy) {
    case 'oldest':
      jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case 'duration':
      jobs.sort((a, b) => jobDurationMs(b) - jobDurationMs(a));
      break;
    case 'errors':
      jobs.sort((a, b) => b.metrics.errorCount - a.metrics.errorCount);
      break;
    case 'newest':
    default:
      jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }

  return paginate(jobs, page, pageSize);
}

export function getActiveJobForSourceLocal(
  store: LocalImportStore,
  sourceId: string,
): ImportJob | null {
  return (
    store.jobs.find(
      (job) =>
        job.sourceId === sourceId && (job.status === 'pending' || job.status === 'running'),
    ) ?? null
  );
}

function matchesRecordFilters(
  record: ImportRecord,
  params: ImportRecordListParams,
  sourceNames: Map<string, string>,
): boolean {
  if (params.importJobId && record.importJobId !== params.importJobId) return false;
  if (params.sourceId && record.sourceId !== params.sourceId) return false;

  const statuses = Array.isArray(params.status)
    ? params.status
    : params.status === 'all'
      ? undefined
      : params.status
        ? [params.status]
        : ['needs_review', 'duplicate'];

  if (statuses && !statuses.includes(record.status)) return false;

  const candidate = (record.normalizedPayload ?? {}) as {
    cityName?: string;
    startDate?: string;
  };

  if (params.cityName && candidate.cityName?.toLowerCase() !== params.cityName.toLowerCase()) {
    return false;
  }
  if (params.fromDate && candidate.startDate) {
    if (new Date(candidate.startDate).getTime() < new Date(params.fromDate).getTime()) return false;
  }
  if (params.toDate && candidate.startDate) {
    if (new Date(candidate.startDate).getTime() > new Date(params.toDate).getTime()) return false;
  }
  if (params.minDuplicateScore !== undefined) {
    if ((record.duplicateScore ?? 0) < params.minDuplicateScore) return false;
  }
  if (params.maxDuplicateScore !== undefined) {
    if ((record.duplicateScore ?? 0) > params.maxDuplicateScore) return false;
  }
  if (params.minMatchConfidence !== undefined) {
    if (computeMatchConfidence(record) < params.minMatchConfidence) return false;
  }
  if (params.withWarnings) {
    if (!record.validationWarnings || record.validationWarnings.length === 0) return false;
  }
  if (params.withoutVenueMatch && record.matchedVenueId) return false;
  if (params.withoutCityMatch && record.matchedCityId) return false;
  if (params.withoutGenreMatch && record.matchedGenreIds && record.matchedGenreIds.length > 0) {
    return false;
  }
  if (params.withoutArtistMatch && record.matchedArtistIds && record.matchedArtistIds.length > 0) {
    return false;
  }

  void sourceNames;
  return true;
}

export function listRecordsLocal(
  store: LocalImportStore,
  params: ImportRecordListParams,
): PaginatedResult<ImportRecord | ImportRecordSummary> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const sourceNames = new Map(store.sources.map((s) => [s.id, s.name]));

  let records = store.records.filter((record) => matchesRecordFilters(record, params, sourceNames));

  switch (params.sortBy) {
    case 'eventDate':
      records.sort((a, b) => {
        const aDate = ((a.normalizedPayload ?? {}) as { startDate?: string }).startDate ?? '';
        const bDate = ((b.normalizedPayload ?? {}) as { startDate?: string }).startDate ?? '';
        return aDate.localeCompare(bDate);
      });
      break;
    case 'duplicateScore':
      records.sort((a, b) => (b.duplicateScore ?? 0) - (a.duplicateScore ?? 0));
      break;
    case 'matchConfidence':
      records.sort(
        (a, b) => computeMatchConfidence(b) - computeMatchConfidence(a),
      );
      break;
    case 'warnings':
      records.sort(
        (a, b) =>
          (b.validationWarnings?.length ?? 0) - (a.validationWarnings?.length ?? 0),
      );
      break;
    case 'newest':
    default:
      records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }

  const paged = paginate(records, page, pageSize);
  if (params.includeRawPayload) {
    return paged;
  }

  return {
    ...paged,
    items: paged.items.map((record) =>
      mapImportRecordToSummary(record, sourceNames.get(record.sourceId)),
    ),
  };
}

export function listLogsLocal(
  store: LocalImportStore,
  params: ImportLogListParams,
): PaginatedResult<ImportLog> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  let logs = store.logs.filter((log) => log.importJobId === params.importJobId);

  if (params.level && params.level !== 'all') {
    logs = logs.filter((log) => log.level === params.level);
  }
  if (params.code) {
    logs = logs.filter((log) => log.code.includes(params.code!));
  }
  if (params.importRecordId) {
    logs = logs.filter((log) => log.importRecordId === params.importRecordId);
  }
  if (params.fromDate) {
    const from = new Date(params.fromDate).getTime();
    logs = logs.filter((log) => new Date(log.createdAt).getTime() >= from);
  }
  if (params.toDate) {
    const to = new Date(params.toDate).getTime();
    logs = logs.filter((log) => new Date(log.createdAt).getTime() <= to);
  }

  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(logs, page, pageSize);
}

export function getMonitoringStatsLocal(store: LocalImportStore): ImportMonitoringStats {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const activeSources = store.sources.filter((s) => s.active).length;
  const failedJobsLast24h = store.jobs.filter(
    (job) => job.status === 'failed' && new Date(job.createdAt).getTime() >= dayAgo,
  ).length;
  const recordsInReview = store.records.filter((r) => r.status === 'needs_review').length;
  const invalidRecords = store.records.filter((r) => r.status === 'invalid').length;
  const duplicateCandidates = store.records.filter((r) => r.status === 'duplicate').length;

  const completedJobs = store.jobs.filter((j) => j.startedAt && j.finishedAt);
  const averageJobDurationMs =
    completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => sum + jobDurationMs(job), 0) / completedJobs.length
      : 0;

  const lastSuccessfulImports = store.jobs
    .filter((j) => j.status === 'completed' || j.status === 'completed_with_warnings')
    .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
    .slice(0, 5)
    .map((job) => {
      const source = store.sources.find((s) => s.id === job.sourceId);
      return {
        sourceId: job.sourceId,
        sourceName: source?.name ?? job.sourceId,
        finishedAt: job.finishedAt ?? job.updatedAt,
        jobId: job.id,
      };
    });

  return {
    activeSources,
    failedJobsLast24h,
    recordsInReview,
    invalidRecords,
    duplicateCandidates,
    averageJobDurationMs,
    lastSuccessfulImports,
  };
}
