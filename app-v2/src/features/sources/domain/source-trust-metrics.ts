export interface SourceTrustMetrics {
  trustScore: number;
  healthScore?: number;
  importSuccessRate?: number;
  duplicateRate?: number;
  mergeRate?: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  consecutiveFailures: number;
  averageEventQuality?: number;
  averagePublishRate?: number;
  totalImportCount: number;
  totalValidEventCount: number;
  totalRejectedEventCount: number;
  errorRate: number;
  updateRate: number;
}

export function buildSourceTrustMetrics(input: {
  trustScore: number;
  healthScore?: number;
  consecutiveFailures?: number;
  duplicateRate?: number;
  mergeRate?: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  totalImportCount?: number;
  totalValidEventCount?: number;
  totalRejectedEventCount?: number;
  errorRate?: number;
  updateRate?: number;
  averageEventQuality?: number;
  averagePublishRate?: number;
}): SourceTrustMetrics {
  const totalImportCount = input.totalImportCount ?? 0;
  const totalValidEventCount = input.totalValidEventCount ?? 0;
  const totalRejectedEventCount = input.totalRejectedEventCount ?? 0;
  const importSuccessRate =
    totalImportCount > 0 ? totalValidEventCount / totalImportCount : undefined;

  return {
    trustScore: input.trustScore,
    healthScore: input.healthScore,
    importSuccessRate,
    duplicateRate: input.duplicateRate ?? 0,
    mergeRate: input.mergeRate ?? input.updateRate ?? 0,
    lastSuccessAt: input.lastSuccessAt,
    lastFailureAt: input.lastFailureAt,
    consecutiveFailures: input.consecutiveFailures ?? 0,
    averageEventQuality: input.averageEventQuality,
    averagePublishRate: input.averagePublishRate,
    totalImportCount,
    totalValidEventCount,
    totalRejectedEventCount,
    errorRate: input.errorRate ?? 0,
    updateRate: input.updateRate ?? 0,
  };
}
