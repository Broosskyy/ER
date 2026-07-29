export interface SourceConnectorMetrics {
  importedEvents: number;
  skippedEvents: number;
  duplicateRate: number;
  mergeRate: number;
  publishRate: number;
  averageResponseTimeMs: number;
  averageMappingTimeMs: number;
  totalRuns: number;
  lastUpdatedAt: string;
}

export function createInitialMetrics(now = new Date().toISOString()): SourceConnectorMetrics {
  return {
    importedEvents: 0,
    skippedEvents: 0,
    duplicateRate: 0,
    mergeRate: 0,
    publishRate: 0,
    averageResponseTimeMs: 0,
    averageMappingTimeMs: 0,
    totalRuns: 0,
    lastUpdatedAt: now,
  };
}

export function recordConnectorRunMetrics(
  current: SourceConnectorMetrics,
  input: {
    importedEvents: number;
    skippedEvents: number;
    durationMs: number;
    mappingTimeMs?: number;
    duplicateRate?: number;
    mergeRate?: number;
    publishRate?: number;
  },
  now = new Date().toISOString(),
): SourceConnectorMetrics {
  const totalRuns = current.totalRuns + 1;
  const averageResponseTimeMs =
    (current.averageResponseTimeMs * current.totalRuns + input.durationMs) / totalRuns;
  const mappingTimeMs = input.mappingTimeMs ?? input.durationMs;
  const averageMappingTimeMs =
    (current.averageMappingTimeMs * current.totalRuns + mappingTimeMs) / totalRuns;

  return {
    importedEvents: current.importedEvents + input.importedEvents,
    skippedEvents: current.skippedEvents + input.skippedEvents,
    duplicateRate: input.duplicateRate ?? current.duplicateRate,
    mergeRate: input.mergeRate ?? current.mergeRate,
    publishRate: input.publishRate ?? current.publishRate,
    averageResponseTimeMs,
    averageMappingTimeMs,
    totalRuns,
    lastUpdatedAt: now,
  };
}
