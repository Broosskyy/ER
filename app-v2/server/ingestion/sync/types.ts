export interface SyncRunCounters {
  discovered: number;
  fetched: number;
  parsed: number;
  planned: number;
  inserted: number;
  updated: number;
  noop: number;
  rejected: number;
  failed: number;
}

export interface SyncRunSummary {
  runId: string;
  connectorId: string;
  startedAt: string;
  finishedAt?: string;
  counters: SyncRunCounters;
}

export function createEmptySyncRunCounters(): SyncRunCounters {
  return {
    discovered: 0,
    fetched: 0,
    parsed: 0,
    planned: 0,
    inserted: 0,
    updated: 0,
    noop: 0,
    rejected: 0,
    failed: 0,
  };
}
