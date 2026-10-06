import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { PermissionStatusBadge } from './PermissionStatusBadge';
import type { PermissionCardViewModel } from '../onboarding/view-models';

const permissionIcons: Record<PermissionCardViewModel['kind'], AppIconName> = {
  location: 'location-outline',
  notifications: 'notifications-outline',
  calendar: 'calendar-outline',
  camera: 'camera-outline',
};

export interface PermissionCardProps {
  permission: PermissionCardViewModel;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Reusable permission prompt card — UI-only. */
export function PermissionCard({
  permission,
  primaryAction,
  secondaryAction,
  style,
  testID,
}: PermissionCardProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="lg" style={style} testID={testID}>
      <View style={styles.header}>
        <AppIcon name={permissionIcons[permission.kind]} size="lg" color={theme.colors.accent} />
        <View style={styles.copy}>
          <AppText role="cardTitle">{permission.title}</AppText>
          {permission.status ? <PermissionStatusBadge status={permission.status} /> : null}
        </View>
      </View>
      <AppText role="bodyMuted" color={theme.colors.textSecondary}>
        {permission.description}
      </AppText>
      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {secondaryAction}
          {primaryAction}
        </View>
      ) : null}
    </CardFoundation>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
