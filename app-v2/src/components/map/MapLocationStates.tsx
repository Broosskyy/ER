import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { EventListItem } from '@/components/discovery/EventListItem';
import { AppText } from '@/components/layout/AppText';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { useTheme } from '@/design/theme';

import type { LocationSearchResultViewModel, SelectedEventMapCardViewModel } from './view-models';

export function SelectedEventMapCard({ event, saved = false, onPress, onFavoritePress }: { event: SelectedEventMapCardViewModel; saved?: boolean; onPress?: () => void; onFavoritePress?: () => void }) {
  return <CardFoundation padding="sm"><EventListItem event={event} saved={saved} onPress={onPress} onFavoritePress={onFavoritePress} /></CardFoundation>;
}

export function LocationPermissionState({ primaryAction, secondaryAction }: { primaryAction?: ReactNode; secondaryAction?: ReactNode }) {
  return <EmptyState title="Standort freigeben" description="Erhalte Events in deiner Nähe, sobald du deinen Standort freigibst." icon="location-outline" primaryAction={primaryAction} secondaryAction={secondaryAction} />;
}

export function LocationDisabledState({ primaryAction, secondaryAction }: { primaryAction?: ReactNode; secondaryAction?: ReactNode }) {
  return <EmptyState title="Standortdienste deaktiviert" description="Aktiviere Standortdienste, um Events in deiner Nähe zu sehen." icon="location-outline" primaryAction={primaryAction} secondaryAction={secondaryAction} />;
}

export function MapEmptyState({ title = 'Keine Events im sichtbaren Bereich', description = 'Verschiebe die Karte oder passe deine Filter an.', primaryAction, secondaryAction }: { title?: string; description?: string; primaryAction?: ReactNode; secondaryAction?: ReactNode }) {
  return <EmptyState title={title} description={description} icon="map-outline" primaryAction={primaryAction} secondaryAction={secondaryAction} />;
}

export function LocationSearchResult({ result, onPress }: { result: LocationSearchResultViewModel; onPress?: () => void }) {
  const { theme } = useTheme();
  return <CardFoundation padding="md" onPress={onPress}><AppText role="bodyStrong">{result.currentLocation ? 'Aktueller Standort' : result.cityLabel}</AppText><AppText role="caption" color={theme.colors.textSecondary}>{[result.regionLabel, result.countryLabel, result.distanceLabel].filter(Boolean).join(' · ')}</AppText></CardFoundation>;
}
