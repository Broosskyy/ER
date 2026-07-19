export interface ImportConfig {
  timeoutMs: number;
  retryCount: number;
  maxRecordsPerJob: number;
  loggingEnabled: boolean;
}

export const importConfig: ImportConfig = {
  timeoutMs: 60_000,
  retryCount: 2,
  maxRecordsPerJob: 500,
  loggingEnabled: true,
};
