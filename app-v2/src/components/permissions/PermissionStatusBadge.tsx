import { Badge } from '@/components/feedback/Badge';
import type { ViewStyle } from 'react-native';

import {
  resolvePermissionBadgeStatus,
  resolvePermissionStatusLabel,
} from '../onboarding/onboarding-styles';
import type { PermissionStatus } from '../onboarding/view-models';

export interface PermissionStatusBadgeProps {
  status: PermissionStatus;
  style?: ViewStyle;
  testID?: string;
}

export function PermissionStatusBadge({ status, style, testID }: PermissionStatusBadgeProps) {
  return (
    <Badge
      label={resolvePermissionStatusLabel(status)}
      status={resolvePermissionBadgeStatus(status)}
      style={style}
      testID={testID}
    />
  );
}
