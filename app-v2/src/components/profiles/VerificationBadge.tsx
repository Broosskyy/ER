import { View } from 'react-native';

import { Badge } from '@/components/feedback/Badge';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';

import { resolveVerificationStatus } from './verification-styles';
import type { VerificationStatus } from './view-models';

export interface VerificationBadgeProps {
  status: VerificationStatus;
  showIcon?: boolean;
}

/** Verification display composed from the shared badge foundation (mockups 38, 50, 55). */
export function VerificationBadge({ status, showIcon = false }: VerificationBadgeProps) {
  const { theme } = useTheme();
  const resolved = resolveVerificationStatus(status);
  const iconColor = resolved.badgeStatus === 'success'
    ? theme.colors.success
    : resolved.badgeStatus === 'warning'
      ? theme.colors.warning
      : resolved.badgeStatus === 'error'
        ? theme.colors.destructive
        : theme.colors.textSecondary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      {showIcon ? <AppIcon name={resolved.icon} size="sm" color={iconColor} /> : null}
      <Badge label={resolved.label} status={resolved.badgeStatus} />
    </View>
  );
}

export { resolveVerificationStatus } from './verification-styles';
