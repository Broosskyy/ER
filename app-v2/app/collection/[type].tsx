import { useLocalSearchParams } from 'expo-router';

import { CollectionScreen } from '@/features/collections/components/CollectionScreen';
import { CollectionUnknownState } from '@/features/collections/components/CollectionHeader';
import { isCollectionType } from '@/features/collections';
import { AppScreen, SafeAreaContainer } from '@/components';

export default function CollectionRouteScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const collectionType = Array.isArray(type) ? type[0] : type;

  if (!isCollectionType(collectionType)) {
    return (
      <AppScreen>
        <SafeAreaContainer edges={['top']} style={{ flex: 1 }}>
          <CollectionUnknownState />
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  return <CollectionScreen type={collectionType} />;
}
