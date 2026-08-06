import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { RepairPlan } from './repair-plan.types';
import { finalizeRepairPlan } from './repair-plan';

export function getRepairPlanArtifactDir(): string {
  return join(process.cwd(), 'docs', 'real-data', 'repair-plans');
}

export class RepairPlanArtifactExistsError extends Error {
  constructor(public readonly artifactPath: string) {
    super(`Repair plan artifact already exists and is immutable: ${artifactPath}`);
    this.name = 'RepairPlanArtifactExistsError';
  }
}

export function getRepairPlanArtifactPath(planId: string): string {
  return join(getRepairPlanArtifactDir(), `${planId}.json`);
}

export function readRepairPlanArtifact(path: string): RepairPlan {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as RepairPlan;
}

export function writeRepairPlanArtifact(
  draft: Omit<RepairPlan, 'changeChecksum' | 'checksum' | 'summary'> & {
    summary?: RepairPlan['summary'];
  },
  options: { allowExisting?: boolean } = {},
): { plan: RepairPlan; artifactPath: string } {
  const plan = finalizeRepairPlan(draft);
  const artifactPath = getRepairPlanArtifactPath(plan.planId);

  if (!options.allowExisting && existsSync(artifactPath)) {
    throw new RepairPlanArtifactExistsError(artifactPath);
  }

  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(plan, null, 2)}\n`, {
    encoding: 'utf8',
    flag: options.allowExisting ? 'w' : 'wx',
  });

  return { plan, artifactPath };
}

export function serializeRepairPlan(plan: RepairPlan): string {
  const { changeChecksum, checksum, ...draft } = plan;
  return `${JSON.stringify(finalizeRepairPlan(draft), null, 2)}\n`;
}
