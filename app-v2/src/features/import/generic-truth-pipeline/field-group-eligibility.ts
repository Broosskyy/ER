import type { IdentityPublishVerdict } from '@/features/import/domain/event-evidence-identity-gate';

import type { FieldGroupDeltaReport } from './field-delta';
import type { FieldGroupEvaluation } from './publish-evaluation';
import {
  ALL_GENERIC_TRUTH_FIELD_GROUPS,
  type GenericTruthFieldGroup,
} from './source-evidence-contract';

export interface FieldGroupEligibilityReport {
  policyEligibleFieldGroups: GenericTruthFieldGroup[];
  reviewRequiredFieldGroups: GenericTruthFieldGroup[];
  blockedFieldGroups: GenericTruthFieldGroup[];
  noChangeFieldGroups: GenericTruthFieldGroup[];
  policyEligibleEvent: boolean;
  fullyPolicyEligibleEvent: boolean;
  partiallyPolicyEligibleEvent: boolean;
  wouldApplyFieldCount: number;
}

const IDENTITY_OK: IdentityPublishVerdict[] = ['exact', 'corroborated'];

function groupRequiresIdentity(group: GenericTruthFieldGroup): boolean {
  return group === 'identity_schedule_venue' || group === 'cta_checkout';
}

function groupRequiresVerifiedAt(group: GenericTruthFieldGroup): boolean {
  return group === 'tickets' || group === 'cta_checkout';
}

export function classifyFieldGroupEligibility(input: {
  fieldGroups: FieldGroupEvaluation[];
  fieldGroupDeltas: FieldGroupDeltaReport[];
  identityVerdict: IdentityPublishVerdict;
  verifiedAtPresent: boolean;
  sourceNativeEvidence: boolean;
  collision: boolean;
  contamination: boolean;
}): FieldGroupEligibilityReport {
  const policyEligibleFieldGroups: GenericTruthFieldGroup[] = [];
  const reviewRequiredFieldGroups: GenericTruthFieldGroup[] = [];
  const blockedFieldGroups: GenericTruthFieldGroup[] = [];
  const noChangeFieldGroups: GenericTruthFieldGroup[] = [];

  for (const group of ALL_GENERIC_TRUTH_FIELD_GROUPS) {
    const evaluation = input.fieldGroups.find((entry) => entry.group === group);
    const delta = input.fieldGroupDeltas.find((entry) => entry.group === group);
    const proposed = evaluation?.proposed ?? false;
    const blocked = evaluation?.blocked ?? false;
    const wouldChange = delta?.wouldChange ?? false;

    if (!proposed || !wouldChange) {
      noChangeFieldGroups.push(group);
      continue;
    }

    if (blocked || input.collision || input.contamination) {
      blockedFieldGroups.push(group);
      continue;
    }

    const identityBlocked =
      groupRequiresIdentity(group) && !IDENTITY_OK.includes(input.identityVerdict);
    const verifiedBlocked = groupRequiresVerifiedAt(group) && !input.verifiedAtPresent;
    const nativeBlocked = !input.sourceNativeEvidence;

    if (identityBlocked || verifiedBlocked || nativeBlocked) {
      if (
        input.identityVerdict === 'partial_review_only' ||
        input.identityVerdict === 'mismatch' ||
        input.identityVerdict === 'unverifiable'
      ) {
        reviewRequiredFieldGroups.push(group);
      } else {
        blockedFieldGroups.push(group);
      }
      continue;
    }

    if (evaluation?.allowed) {
      policyEligibleFieldGroups.push(group);
    } else {
      blockedFieldGroups.push(group);
    }
  }

  const proposedGroups = input.fieldGroupDeltas.filter((delta) => delta.wouldChange).map((d) => d.group);
  const fullyPolicyEligibleEvent =
    proposedGroups.length > 0 &&
    proposedGroups.every((group) => policyEligibleFieldGroups.includes(group));
  const partiallyPolicyEligibleEvent =
    policyEligibleFieldGroups.length > 0 && !fullyPolicyEligibleEvent;
  const policyEligibleEvent = policyEligibleFieldGroups.length > 0;

  const wouldApplyFieldCount = input.fieldGroupDeltas.reduce((count, delta) => {
    if (!delta.wouldChange || !policyEligibleFieldGroups.includes(delta.group)) {
      return count;
    }
    return count + Object.keys(delta.proposed as object).length;
  }, 0);

  return {
    policyEligibleFieldGroups,
    reviewRequiredFieldGroups,
    blockedFieldGroups,
    noChangeFieldGroups,
    policyEligibleEvent,
    fullyPolicyEligibleEvent,
    partiallyPolicyEligibleEvent,
    wouldApplyFieldCount,
  };
}
