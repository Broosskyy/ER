export function createExecutionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `exec_${crypto.randomUUID()}`;
  }
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `corr_${crypto.randomUUID()}`;
  }
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
