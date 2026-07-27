import { View } from 'react-native';

import { EventDiscoveryTile } from '@/components/discovery/EventDiscoveryTile';
import {
  cancelledEvent,
  clubNightEvent,
  hardTechnoEvent,
  postponedEvent,
  soldOutFestivalEvent,
} from '@/components/discovery/preview-fixtures';
import { toEventDiscoveryTileViewModel } from '@/components/discovery/view-models';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { getEventImageAsset } from '@/features/events/data/demo-images';

import { PreviewThemeFrame } from './PreviewThemeFrame';

const baseEvent = toEventDiscoveryTileViewModel({
  ...hardTechnoEvent,
  image: getEventImageAsset(hardTechnoEvent.id),
});
const postponedTile = toEventDiscoveryTileViewModel({
  ...postponedEvent,
  image: getEventImageAsset(postponedEvent.id),
});
const cancelledTile = toEventDiscoveryTileViewModel({
  ...cancelledEvent,
  image: getEventImageAsset(cancelledEvent.id),
});
const soldOutTile = toEventDiscoveryTileViewModel(soldOutFestivalEvent);
const todayTile = toEventDiscoveryTileViewModel({
  ...clubNightEvent,
  image: getEventImageAsset(clubNightEvent.id),
});

function TileShowcase() {
  return (
    <Stack gap="lg">
      <Section title="EventDiscoveryTile — Standard">
        <View style={{ flexDirection: 'row', gap: 4, maxWidth: 360 }}>
          <View style={{ flex: 1 }}>
            <EventDiscoveryTile event={baseEvent} onPress={() => undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <EventDiscoveryTile event={baseEvent} saved onPress={() => undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <EventDiscoveryTile
              event={baseEvent}
              onPress={() => undefined}
              onFavoritePress={() => undefined}
            />
          </View>
        </View>
      </Section>
      <Section title="Featured / Status">
        <View style={{ flexDirection: 'row', gap: 4, maxWidth: 360 }}>
          <View style={{ flex: 2 }}>
            <EventDiscoveryTile event={baseEvent} variant="wide" onPress={() => undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <EventDiscoveryTile event={baseEvent} variant="standard" onPress={() => undefined} />
          </View>
        </View>
        <EventDiscoveryTile event={postponedTile} variant="wide" onPress={() => undefined} />
        <EventDiscoveryTile event={cancelledTile} variant="standard" onPress={() => undefined} />
        <EventDiscoveryTile event={soldOutTile} variant="standard" onPress={() => undefined} />
        <EventDiscoveryTile event={todayTile} variant="standard" onPress={() => undefined} />
      </Section>
      <Section title="Loading / Fallback">
        <Skeleton shape="card" height={110} />
        <EventDiscoveryTile event={{ ...baseEvent, image: undefined }} onPress={() => undefined} />
      </Section>
    </Stack>
  );
}

export function Phase2AExploreGridPreview() {
  return (
    <Section
      title="Sprint 2A — Event Discovery Grid"
      subtitle="Image-first explore tiles for the Events tab default state"
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <PreviewThemeFrame mode="light" label="Light">
          <TileShowcase />
        </PreviewThemeFrame>
        <PreviewThemeFrame mode="dark" label="Dark">
          <TileShowcase />
        </PreviewThemeFrame>
      </View>
    </Section>
  );
}
