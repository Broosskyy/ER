import type { ImageSourcePropType } from 'react-native';

const OPS_STUB: ImageSourcePropType = { uri: 'ops-demo-stub' };

function resolveDemoAsset(eventId: string, imageAssetKey?: string): ImageSourcePropType {
  // Lazy require keeps Node ops scripts from loading binary demo assets at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getEventImageAsset } = require('./demo-image-assets') as typeof import('./demo-image-assets');
  return getEventImageAsset(eventId, imageAssetKey);
}

export function resolveEventImageSource(input: {
  id: string;
  imageUrl?: string;
  imageAssetKey?: string;
}): ImageSourcePropType {
  const remoteUrl = input.imageUrl?.trim();
  if (remoteUrl) {
    return { uri: remoteUrl };
  }

  if (process.env.ER_OPS_SCRIPT === '1') {
    return OPS_STUB;
  }

  return resolveDemoAsset(input.id, input.imageAssetKey);
}
