import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function EmptyState({ title, description, action, style, testID }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <AppText variant="heading" style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySmall" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
  },
});
