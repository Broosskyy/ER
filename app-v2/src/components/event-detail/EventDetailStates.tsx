import { StyleSheet, View, ViewStyle } from 'react-native';

import { Banner } from '@/components/feedback/Banner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';

export interface EventDetailSkeletonProps {
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 60 event detail loading state — reuses Skeleton. */
export function EventDetailSkeleton({ style, testID }: EventDetailSkeletonProps) {
  return (
    <Stack gap="lg" style={style} testID={testID}>
      <Skeleton shape="card" height={220} />
      <Skeleton shape="text" width="70%" />
      <Skeleton shape="text" />
      <View style={styles.rows}>
        <Skeleton shape="text" />
        <Skeleton shape="text" width="80%" />
        <Skeleton shape="text" width="60%" />
      </View>
      <Skeleton shape="card" height={140} />
    </Stack>
  );
}

export interface EventDetailErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Event detail error presentation — Banner + optional retry. */
export function EventDetailErrorState({
  title = 'Event konnte nicht geladen werden',
  message = 'Bitte versuche es erneut oder kehre zur Übersicht zurück.',
  onRetry,
  style,
  testID,
}: EventDetailErrorStateProps) {
  return (
    <Stack gap="md" style={style} testID={testID}>
      <Banner title={title} message={message} variant="error" />
      <EmptyState
        title="Event nicht verfügbar"
        description={message}
        icon="alert-circle-outline"
        primaryAction={onRetry ? <PrimaryButton label="Erneut versuchen" onPress={onRetry} /> : undefined}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.sm,
  },
});
