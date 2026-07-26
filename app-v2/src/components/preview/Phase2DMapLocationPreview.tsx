import { View } from 'react-native';

import { EventMapCluster, EventMapPin } from '@/components/map/MapMarkers';
import { CitySelector, DistanceChip, MapFilterButton, MapListToggle, RecenterButton } from '@/components/map/MapControls';
import { MapContainer } from '@/components/map/MapContainer';
import { LocationDisabledState, LocationPermissionState, LocationSearchResult, MapEmptyState, SelectedEventMapCard } from '@/components/map/MapLocationStates';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';

import { PreviewThemeFrame } from './PreviewThemeFrame';

const selectedEvent = { kind: 'event' as const, id: 'void-map', title: 'VOID: Techno Saturday', dateLabel: 'Heute', timeLabel: '23:00', venueLabel: 'Sisyphos', cityLabel: 'Berlin', genreLabels: ['Techno'], accessibilityLabel: 'VOID Techno Saturday in Berlin' };

function MapShowcase() {
  return <Stack gap="md">
    <MapContainer accessibilityLabel="Kartenfläche"><View style={{ flexDirection: 'row', gap: 8 }}><EventMapPin pin={{ id: 'void', label: 'ab 15 €', status: 'selected', accessibilityLabel: 'Ausgewähltes VOID Event' }} onPress={() => undefined} /><EventMapCluster cluster={{ id: 'berlin-mitte', count: 8, accessibilityLabel: '8 Events in Berlin Mitte' }} onPress={() => undefined} /></View></MapContainer>
    <MapContainer state="loading" accessibilityLabel="Karte wird geladen" />
    <MapContainer state="offline" accessibilityLabel="Karte offline" />
    <MapContainer state="empty" accessibilityLabel="Keine Events auf der Karte" />
    <SelectedEventMapCard event={selectedEvent} saved onPress={() => undefined} onFavoritePress={() => undefined} />
  </Stack>;
}

function ControlsShowcase() {
  return <Stack gap="md"><Stack direction="horizontal" gap="sm" style={{ flexWrap: 'wrap' }}><RecenterButton onPress={() => undefined} /><RecenterButton state="loading" /><RecenterButton state="permission_required" onPress={() => undefined} /><MapFilterButton active count={3} onPress={() => undefined} /><MapListToggle value="map" onChange={() => undefined} /></Stack><CitySelector cityLabel="Berlin, Germany" selected onPress={() => undefined} /><Stack direction="horizontal" gap="sm" style={{ flexWrap: 'wrap' }}><DistanceChip label="5 km" selected onPress={() => undefined} /><DistanceChip label="25 km" onPress={() => undefined} /><DistanceChip label="Beliebig" onPress={() => undefined} /></Stack></Stack>;
}

function LocationShowcase() {
  return <Stack gap="md"><LocationPermissionState primaryAction={<PrimaryButton label="Standort freigeben" onPress={() => undefined} />} /><LocationDisabledState /><MapEmptyState /><LocationSearchResult result={{ id: 'koeln', cityLabel: 'Köln', regionLabel: 'Nordrhein-Westfalen', countryLabel: 'Deutschland', distanceLabel: '25 km', recent: true, accessibilityLabel: 'Köln, Nordrhein-Westfalen, Deutschland' }} onPress={() => undefined} /></Stack>;
}

export function Phase2DMapLocationPreview() {
  return <Section title="Sprint 2A Phase 2D – Map & Location Components" subtitle="UI-only map and location presentation — no map SDK, permissions, or geolocation"><Section title="Map, Pins & Overlays"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><PreviewThemeFrame mode="light" label="Light"><MapShowcase /></PreviewThemeFrame><PreviewThemeFrame mode="dark" label="Dark"><MapShowcase /></PreviewThemeFrame></View></Section><Section title="Controls & Location States"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><PreviewThemeFrame mode="light" label="Light"><ControlsShowcase /><LocationShowcase /></PreviewThemeFrame><PreviewThemeFrame mode="dark" label="Dark"><ControlsShowcase /><LocationShowcase /></PreviewThemeFrame></View></Section></Section>;
}
