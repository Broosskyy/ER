import { AppScreen } from '@/components';
import { MapUnavailableState } from '@/features/map/components/MapUnavailableState';

export default function MapTabScreen() {
  return (
    <AppScreen>
      <MapUnavailableState />
    </AppScreen>
  );
}
