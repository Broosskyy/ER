const SENSITIVE_KEY_PATTERN =
  /(html|payload|authorization|cookie|api[_-]?key|secret|password|token|bearer)/i;

export function sanitizeExecutionLogMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }
    if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = '[truncated]';
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}
