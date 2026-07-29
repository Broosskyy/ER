export const WEBSITE_DEFAULT_LIMITS = {
  maxRedirects: 3,
  maxResponseBytes: 5 * 1024 * 1024,
  timeoutMs: 60_000,
  maxPaginationPages: 5,
  maxDetailPages: 10,
  maxEventsPerRun: 500,
  maxPagesPerRun: 10,
} as const;

export interface WebsiteRunLimits {
  maxRedirects: number;
  maxResponseBytes: number;
  timeoutMs: number;
  maxPaginationPages: number;
  maxDetailPages: number;
  maxEventsPerRun: number;
  maxPagesPerRun: number;
}

export function resolveWebsiteRunLimits(
  overrides: Partial<WebsiteRunLimits> = {},
): WebsiteRunLimits {
  return {
    ...WEBSITE_DEFAULT_LIMITS,
    ...overrides,
  };
}
