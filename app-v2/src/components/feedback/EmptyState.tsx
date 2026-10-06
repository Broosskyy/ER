import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing, spacingRoles } from '@/design/spacing';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: AppIconName;
  /** @deprecated Use primaryAction */
  action?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Centered empty content state — mockup 57.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  primaryAction,
  secondaryAction,
  style,
  testID,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const { colorRoles } = theme;
  const resolvedPrimaryAction = primaryAction ?? action;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {icon ? <AppIcon name={icon} size="lg" color={colorRoles.emptyStateIcon} /> : null}
      <AppText role="sectionTitle" color={colorRoles.emptyStateTitle} style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText role="bodyMuted" color={colorRoles.emptyStateDescription} style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {resolvedPrimaryAction || secondaryAction ? (
        <Stack direction="horizontal" gap="md" align="center" style={styles.actions}>
          {resolvedPrimaryAction}
          {secondaryAction}
        </Stack>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});
