import { ImageSourcePropType } from 'react-native';

/** Distinct abstract demo posters for Köln published events. */
export const EVENT_IMAGE_ASSETS: Record<string, ImageSourcePropType> = {
  'void-techno-saturday': require('../../../../assets/demo/posters/poster-void.png'),
  'klangkuenstler-berghain': require('../../../../assets/demo/posters/poster-klang.png'),
  'fckng-serious': require('../../../../assets/demo/posters/poster-fckng.png'),
  'watergate-nights': require('../../../../assets/demo/posters/poster-rhein.png'),
  'sisyphos-open-air': require('../../../../assets/demo/posters/poster-gebaeude.png'),
  'poster-void': require('../../../../assets/demo/posters/poster-void.png'),
  'poster-klang': require('../../../../assets/demo/posters/poster-klang.png'),
  'poster-fckng': require('../../../../assets/demo/posters/poster-fckng.png'),
  'poster-rhein': require('../../../../assets/demo/posters/poster-rhein.png'),
  'poster-gebaeude': require('../../../../assets/demo/posters/poster-gebaeude.png'),
  'minimal-warehouse': require('../../../../assets/demo/posters/poster-void.png'),
  'no-coords-berlin': require('../../../../assets/demo/posters/poster-rhein.png'),
};

const FALLBACK_IMAGE = require('../../../../assets/demo/posters/poster-void.png');

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
