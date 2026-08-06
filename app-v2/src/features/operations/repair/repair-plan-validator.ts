import type { SupabaseClient } from '@supabase/supabase-js';

import { collectRepairAuditDataset } from './repair-plan-builder';
import { resolveRepairEnvironment } from './repair-environment';
import { fingerprintRepairRecord, validateRepairPlanChecksum } from './repair-plan';
import type {
  RepairPlan,
  RepairPlanValidationIssue,
  RepairPlanValidationResult,
} from './repair-plan.types';

export interface RepairPlanValidationContext {
  supabaseUrl?: string;
  client?: SupabaseClient;
}

function issue(
  code: RepairPlanValidationIssue['code'],
  message: string,
  entityId?: string,
  fieldOrRelationship?: string,
): RepairPlanValidationIssue {
  return { code, message, entityId, fieldOrRelationship };
}

export async function validateRepairPlanArtifact(
  plan: RepairPlan,
  context: RepairPlanValidationContext = {},
): Promise<RepairPlanValidationResult> {
  const checkedAt = new Date().toISOString();
  const issues: RepairPlanValidationIssue[] = [];
  const env = resolveRepairEnvironment(context.supabaseUrl);

  if (plan.planVersion !== '1.0.0') {
    issues.push(issue('plan_version_unsupported', `Unsupported plan version: ${plan.planVersion}`));
  }

  if (!validateRepairPlanChecksum(plan)) {
    issues.push(issue('checksum_invalid', 'Repair plan checksum validation failed.'));
  }

  if (plan.environment !== env.environment) {
    issues.push(
      issue(
        'environment_mismatch',
        `Plan environment ${plan.environment} does not match current environment ${env.environment}.`,
      ),
    );
  }

  if (plan.projectId !== env.projectId) {
    issues.push(
      issue(
        'project_mismatch',
        `Plan project ${plan.projectId} does not match current project ${env.projectId}.`,
      ),
    );
  }

  if (plan.schemaWatermark !== env.schemaWatermark) {
    issues.push(
      issue(
        'schema_watermark_stale',
        `Plan schema watermark ${plan.schemaWatermark} does not match current ${env.schemaWatermark}.`,
      ),
    );
  }

  if (plan.repairVersion !== env.repairVersion) {
    issues.push(
      issue(
        'repair_version_stale',
        `Plan repair version ${plan.repairVersion} does not match current ${env.repairVersion}.`,
      ),
    );
  }

  for (const change of plan.changes) {
    if (change.safety === 'unsupported') {
      issues.push(
        issue(
          'unsupported_safety_state',
          `Unsupported repair safety state for ${change.fieldOrRelationship}.`,
          change.entityId,
          change.fieldOrRelationship,
        ),
      );
    }
    if (change.safety === 'blocked_manual_lock') {
      issues.push(
        issue(
          'manual_lock_blocked',
          `Manual lock blocks ${change.fieldOrRelationship}.`,
          change.entityId,
          change.fieldOrRelationship,
        ),
      );
    }
    if (change.safety === 'blocked_missing_provenance') {
      issues.push(
        issue(
          'missing_provenance_blocked',
          `Missing provenance authority for ${change.fieldOrRelationship}.`,
          change.entityId,
          change.fieldOrRelationship,
        ),
      );
    }
  }

  if (context.client) {
    const dataset = await collectRepairAuditDataset(context.client);

    if (dataset.activeImportJobs.length > 0) {
      issues.push(
        issue(
          'active_import_jobs',
          `Active import jobs detected (${dataset.activeImportJobs.length}).`,
        ),
      );
    }

    const eventById = new Map(dataset.publishedEvents.map((event) => [event.id, event]));
    const importByEvent = dataset.importRecordsByEventId;

    for (const snapshot of plan.recordSnapshots) {
      if (snapshot.entityType !== 'event') {
        continue;
      }
      const current = eventById.get(snapshot.entityId);
      if (!current) {
        issues.push(
          issue(
            'record_fingerprint_stale',
            `Event ${snapshot.entityId} is no longer published.`,
            snapshot.entityId,
          ),
        );
        continue;
      }

      const importRecord = importByEvent.get(snapshot.entityId);
      const liveFingerprint = fingerprintRepairRecord({
        event: current,
        importRecordUpdatedAt: importRecord?.updatedAt,
      });
      if (snapshot.fingerprint !== liveFingerprint) {
        issues.push(
          issue(
            'record_fingerprint_stale',
            `Event fingerprint changed for ${snapshot.entityId}.`,
            snapshot.entityId,
          ),
        );
      }

      if (
        snapshot.importRecordUpdatedAt &&
        importRecord?.updatedAt &&
        snapshot.importRecordUpdatedAt !== importRecord.updatedAt
      ) {
        issues.push(
          issue(
            'import_record_stale',
            `Import record freshness changed for ${snapshot.entityId}.`,
            snapshot.entityId,
          ),
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    planId: plan.planId,
    environment: plan.environment,
    projectId: plan.projectId,
    checkedAt,
    issues,
  };
}
