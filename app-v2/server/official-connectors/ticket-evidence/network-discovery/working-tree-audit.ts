import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface WorkingTreeFileAudit {
  path: string;
  status: 'modified' | 'untracked';
  likelyMilestone: string;
  diffSummary: string;
  requiredForCurrentBehavior: boolean;
  legitimateUnfinishedPriorWork: boolean;
  temporaryOrDebugOnly: boolean;
  conflictsWithM932C: boolean;
  recommendation: 'preserve' | 'review_before_commit' | 'exclude_from_b2c_commit';
}

const CODE_ROOT = 'app-v2';

function isCodeFile(path: string): boolean {
  return (
    path.startsWith(`${CODE_ROOT}/`) &&
    (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js')) &&
    !path.includes('/node_modules/')
  );
}

function classifyFile(path: string): Omit<WorkingTreeFileAudit, 'path' | 'status' | 'diffSummary'> {
  if (path.includes('/scripts/debug-')) {
    return {
      likelyMilestone: 'debug/temporary',
      requiredForCurrentBehavior: false,
      legitimateUnfinishedPriorWork: true,
      temporaryOrDebugOnly: true,
      conflictsWithM932C: false,
      recommendation: 'exclude_from_b2c_commit',
    };
  }
  if (path.includes('/network-discovery/') && !path.includes('genre-coverage') && !path.includes('lineup-coverage')) {
    return {
      likelyMilestone: 'M9.3B.1 ticket.io network discovery',
      requiredForCurrentBehavior: false,
      legitimateUnfinishedPriorWork: true,
      temporaryOrDebugOnly: false,
      conflictsWithM932C: false,
      recommendation: 'preserve',
    };
  }
  if (
    path.includes('relevance-classifier.ts') ||
    path.includes('relevance-evidence.ts') ||
    path.includes('media-classifier.ts') ||
    path.includes('types.ts')
  ) {
    return {
      likelyMilestone: 'M9.3B.1 relevance/media refactor',
      requiredForCurrentBehavior: false,
      legitimateUnfinishedPriorWork: true,
      temporaryOrDebugOnly: false,
      conflictsWithM932C: false,
      recommendation: 'review_before_commit',
    };
  }
  return {
    likelyMilestone: 'historical/unclassified',
    requiredForCurrentBehavior: false,
    legitimateUnfinishedPriorWork: false,
    temporaryOrDebugOnly: path.includes('/artifacts/') || path.endsWith('_REPORT.md'),
    conflictsWithM932C: false,
    recommendation: 'preserve',
  };
}

export function auditWorkingTree(repoRoot: string): WorkingTreeFileAudit[] {
  const status = execSync('git status --short', { cwd: repoRoot, encoding: 'utf8' });
  const audits: WorkingTreeFileAudit[] = [];

  for (const line of status.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
    const statusCode = line.slice(0, 2).trim();
    const filePath = line.slice(3).trim().replace(/\\/g, '/');
    if (!isCodeFile(filePath)) {
      continue;
    }
    const classification = classifyFile(filePath);
    let diffSummary = 'untracked file';
    if (statusCode.includes('M')) {
      try {
        const diff = execSync(`git diff --stat -- "${filePath}"`, { cwd: repoRoot, encoding: 'utf8' }).trim();
        diffSummary = diff || 'modified without diff stat';
      } catch {
        diffSummary = 'modified';
      }
    }
    audits.push({
      path: filePath,
      status: statusCode === '??' ? 'untracked' : 'modified',
      diffSummary,
      ...classification,
    });
  }

  return audits;
}

export function workingTreeHasUnsafeAmbiguity(audits: WorkingTreeFileAudit[]): boolean {
  return audits.some((entry) => entry.conflictsWithM932C);
}
