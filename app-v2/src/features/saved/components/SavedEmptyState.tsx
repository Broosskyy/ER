import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SavedEmptyState as SavedEmptyStatePresentation } from '@/components/saved/SavedEmptyState';
import { resolveSavedEmptyCopy } from '@/components/saved/saved-styles';
import type { SavedEmptyVariant } from '@/components/saved/view-models';

export interface SavedEmptyStateProps {
  variant?: SavedEmptyVariant;
  onExploreEvents: () => void;
}

export function SavedEmptyState({ variant = 'no_saved', onExploreEvents }: SavedEmptyStateProps) {
  const copy = resolveSavedEmptyCopy(variant);

  return (
    <SavedEmptyStatePresentation
      empty={{ variant, title: copy.title, description: copy.description }}
      primaryAction={<PrimaryButton label="Events entdecken" onPress={onExploreEvents} />}
      testID="saved-empty-state"
    />
  );
}
