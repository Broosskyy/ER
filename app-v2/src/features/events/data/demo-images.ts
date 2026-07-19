import { ImageSourcePropType } from 'react-native';

export const EVENT_IMAGE_ASSETS: Record<string, ImageSourcePropType> = {
  'void-techno-saturday': require('../../../../assets/demo/event-void.png'),
  'klangkuenstler-berghain': require('../../../../assets/demo/event-berghain.png'),
  'fckng-serious': require('../../../../assets/demo/event-about-blank.png'),
  'watergate-nights': require('../../../../assets/demo/event-watergate.png'),
  'sisyphos-open-air': require('../../../../assets/demo/event-sisyphos.png'),
  'minimal-warehouse': require('../../../../assets/demo/event-void.png'),
  'no-coords-berlin': require('../../../../assets/demo/event-watergate.png'),
};

const FALLBACK_IMAGE = require('../../../../assets/demo/event-void.png');

export function getEventImageAsset(eventId: string, imageAssetKey?: string): ImageSourcePropType {
  const key = imageAssetKey ?? eventId;
  return EVENT_IMAGE_ASSETS[key] ?? FALLBACK_IMAGE;
}

export function getSourceDisplayLabel(source: string): string {
  switch (source) {
    case 'demo':
      return 'Demo source';
    case 'manual':
      return 'Manual import';
    case 'local-json':
      return 'Local JSON';
    default:
      return source;
  }
}
