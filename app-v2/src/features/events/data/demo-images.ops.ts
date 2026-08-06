import type { ImageSourcePropType } from 'react-native';

const OPS_STUB: ImageSourcePropType = { uri: 'ops-demo-stub' };

export const EVENT_IMAGE_ASSETS: Record<string, ImageSourcePropType> = {};

export function getEventImageAsset(_eventId?: string, _imageAssetKey?: string): ImageSourcePropType {
  return OPS_STUB;
}
