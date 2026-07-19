export interface ImportConfig {
  timeoutMs: number;
  retryCount: number;
  maxRecordsPerJob: number;
  loggingEnabled: boolean;
  maxResponseBytes: number;
  maxRedirects: number;
  maxDescriptionLength: number;
  maxTitleLength: number;
  maxFieldLength: number;
  maxRecurrenceInstances: number;
}

export const importConfig: ImportConfig = {
  timeoutMs: 60_000,
  retryCount: 2,
  maxRecordsPerJob: 500,
  loggingEnabled: true,
  maxResponseBytes: 5 * 1024 * 1024,
  maxRedirects: 3,
  maxDescriptionLength: 20_000,
  maxTitleLength: 500,
  maxFieldLength: 2_000,
  maxRecurrenceInstances: 50,
};

export const FIELD_LIMITS = {
  title: importConfig.maxTitleLength,
  description: importConfig.maxDescriptionLength,
  field: importConfig.maxFieldLength,
} as const;
