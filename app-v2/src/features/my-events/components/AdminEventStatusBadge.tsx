import { Badge } from '@/components/feedback/Badge';
import type { BadgeStatus } from '@/components/feedback/badge-styles';
import type { AdminEventStatus } from '@/data/types/records';
import { useEventStatusLabel } from '@/features/my-events/hooks/useEventStatusLabel';

const ADMIN_STATUS_BADGE: Record<AdminEventStatus, BadgeStatus> = {
  draft: 'default',
  review: 'info',
  published: 'success',
  rejected: 'warning',
  archived: 'default',
};

export interface AdminEventStatusBadgeProps {
  status: AdminEventStatus;
}

export function AdminEventStatusBadge({ status }: AdminEventStatusBadgeProps) {
  const label = useEventStatusLabel(status);
  return <Badge label={label} status={ADMIN_STATUS_BADGE[status]} />;
}
