import type { SavedEmptyVariant } from './view-models';

const emptyTitles: Record<SavedEmptyVariant, string> = {
  no_saved: 'Noch keine gespeicherten Events',
  no_filter_results: 'Keine Events für diesen Filter',
  no_past: 'Keine vergangenen Events',
  empty_collection: 'Collection ist leer',
};

const emptyDescriptions: Record<SavedEmptyVariant, string> = {
  no_saved: 'Speichere Events, die du nicht verpassen willst.',
  no_filter_results: 'Passe deinen Filter an oder setze ihn zurück.',
  no_past: 'Vergangene gespeicherte Events erscheinen hier.',
  empty_collection: 'Füge Events hinzu, um diese Collection zu füllen.',
};

export function resolveSavedEmptyCopy(variant: SavedEmptyVariant): { title: string; description: string } {
  return {
    title: emptyTitles[variant],
    description: emptyDescriptions[variant],
  };
}
