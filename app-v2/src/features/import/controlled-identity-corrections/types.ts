import type { AdminEventRecord } from '@/data/types/records';

export type GateMutation = {
  gate: 'A' | 'B' | 'C';
  eventId: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
};

export type EventBackupSnapshot = {
  event: Partial<AdminEventRecord>;
  sourceReferences: unknown[];
  provenance: Record<string, unknown>;
  projection: Record<string, unknown>;
};

export type PreflightEvidence = {
  eventId: string;
  title: string;
  passed: boolean;
  evidence: Record<string, unknown>;
  abortReason?: string;
};

export type ConsumerVerificationResult = {
  eventId: string;
  title: string;
  checks: Record<string, boolean>;
  projection: Record<string, unknown>;
  passed: boolean;
};
