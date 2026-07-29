import type { ImageSourcePropType } from 'react-native';

import { getEventImageAsset } from './demo-image-assets';

export function resolveEventImageSource(input: {
  id: string;
  imageUrl?: string;
  imageAssetKey?: string;
}): ImageSourcePropType {
  const remoteUrl = input.imageUrl?.trim();
  if (remoteUrl) {
    return { uri: remoteUrl };
  }

  return getEventImageAsset(input.id, input.imageAssetKey);
}
