import type { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Banner } from '@/components/feedback/Banner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';

export interface NoResultsStateProps {
  title?: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/** No-results presentation — reuses `EmptyState`. */
export function NoResultsState({
  title = 'Keine Ergebnisse',
  description = 'Passe deine Suche oder Filter an und versuche es erneut.',
  primaryAction,
  secondaryAction,
  style,
  testID,
}: NoResultsStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon="search-outline"
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      style={style}
      testID={testID}
    />
  );
}

export interface SearchLoadingStateProps {
  itemCount?: number;
  style?: ViewStyle;
  testID?: string;
}

/** Search loading presentation — reuses `Skeleton`. */
export function SearchLoadingState({ itemCount = 3, style, testID }: SearchLoadingStateProps) {
  return (
    <Stack gap="md" style={style} testID={testID}>
      <Skeleton shape="text" width="40%" />
      {Array.from({ length: itemCount }, (_, index) => (
        <View key={index} style={styles.loadingRow}>
          <Skeleton shape="thumbnail" />
          <View style={styles.loadingCopy}>
            <Skeleton shape="text" />
            <Skeleton shape="text" width="70%" />
            <Skeleton shape="text" width="50%" />
          </View>
        </View>
      ))}
    </Stack>
  );
}

export interface SearchErrorStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Search error presentation — reuses `Banner`. */
export function SearchErrorState({
  title = 'Suche fehlgeschlagen',
  message = 'Die Ergebnisse konnten nicht geladen werden. Bitte versuche es erneut.',
  actionLabel = 'Erneut versuchen',
  onAction,
  onDismiss,
  style,
  testID,
}: SearchErrorStateProps) {
  return (
    <Banner
      title={title}
      message={message}
      variant="error"
      actionLabel={actionLabel}
      onAction={onAction}
      dismissible={Boolean(onDismiss)}
      onDismiss={onDismiss}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  loadingCopy: {
    flex: 1,
    gap: spacing.sm,
  },
});
