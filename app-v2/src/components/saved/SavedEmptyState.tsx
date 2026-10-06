import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';

import { resolveSavedEmptyCopy } from './saved-styles';
import type { SavedEmptyVariant, SavedEmptyViewModel } from './view-models';

export interface SavedEmptyStateProps {
  empty: SavedEmptyViewModel;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 14 / 57 saved empty states — reuses EmptyState. */
export function SavedEmptyState({
  empty,
  primaryAction,
  secondaryAction,
  style,
  testID,
}: SavedEmptyStateProps) {
  const fallback = resolveSavedEmptyCopy(empty.variant);

  return (
    <EmptyState
      title={empty.title || fallback.title}
      description={empty.description ?? fallback.description}
      icon="bookmark-outline"
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      style={style}
      testID={testID}
    />
  );
}

export type { SavedEmptyVariant };
