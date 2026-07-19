import { AppScreen, ResponsiveScreen } from '@/components';
import { MapUnavailableState } from '@/features/map/components/MapUnavailableState';

export default function MapTabScreen() {
  return (
    <AppScreen>
      <ResponsiveScreen>
        <MapUnavailableState />
      </ResponsiveScreen>
    </AppScreen>
  );
}
