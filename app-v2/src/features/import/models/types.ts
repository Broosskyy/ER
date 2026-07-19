import type {
  ImportJobStatus,
  ImportLogLevel,
  ImportRecordStatus,
  ImportTriggerType,
} from './statuses';

export interface ImportSource {
  id: string;
  name: string;
  type: string;
  website?: string;
  trustScore: number;
  active: boolean;
  adapterKey?: string;
}

export interface ImportJob {
  id: string;
  sourceId: string;
  status: ImportJobStatus;
  triggerType: ImportTriggerType;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  importJobId: string;
  sourceId: string;
  externalId: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  status: ImportRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ImportLog {
  id: string;
  importJobId: string;
  importRecordId?: string;
  level: ImportLogLevel;
  code: string;
  message: string;
  createdAt: string;
}

export interface CreateImportJobInput {
  sourceId: string;
  triggerType: ImportTriggerType;
  status?: ImportJobStatus;
}

export interface CreateImportRecordInput {
  importJobId: string;
  sourceId: string;
  externalId: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  status?: ImportRecordStatus;
}

export interface CreateImportLogInput {
  importJobId: string;
  importRecordId?: string;
  level: ImportLogLevel;
  code: string;
  message: string;
}
