import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/feedback/Badge';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { resolveEventStatus, resolveTicketStatus } from './event-status-styles';
import type { EventStatus, EventTicketStatus } from './view-models';

export interface EventStatusBadgeProps {
  status: EventStatus;
  showIcon?: boolean;
}

export interface TicketStatusBadgeProps {
  status: EventTicketStatus;
  showIcon?: boolean;
}

/** Status badge composed from the shared Badge foundation. */
export function EventStatusBadge({ status, showIcon = false }: EventStatusBadgeProps) {
  const { theme } = useTheme();
  const resolved = resolveEventStatus(status);

  return (
    <View style={styles.container}>
      {showIcon ? (
        <AppIcon
          name={resolved.icon}
          size="sm"
          color={getStatusIconColor(theme, resolved.badgeStatus)}
        />
      ) : null}
      <Badge label={resolved.label} status={resolved.badgeStatus} />
    </View>
  );
}

/** Ticket availability display composed from the shared Badge foundation. */
export function TicketStatusBadge({ status, showIcon = false }: TicketStatusBadgeProps) {
  const { theme } = useTheme();
  const resolved = resolveTicketStatus(status);

  return (
    <View style={styles.container}>
      {showIcon ? (
        <AppIcon
          name={resolved.icon}
          size="sm"
          color={getStatusIconColor(theme, resolved.badgeStatus)}
        />
      ) : null}
      <Badge label={resolved.label} status={resolved.badgeStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});

function getStatusIconColor(
  theme: ReturnType<typeof useTheme>['theme'],
  status: 'default' | 'success' | 'warning' | 'error' | 'info',
) {
  switch (status) {
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
      return theme.colors.destructive;
    case 'info':
      return theme.colors.info;
    case 'default':
    default:
      return theme.colors.textSecondary;
  }
}
