import { ImageSourcePropType } from 'react-native';

/** Realistic demo photography for Köln published events and club rails. */
export const EVENT_IMAGE_ASSETS: Record<string, ImageSourcePropType> = {
  'void-techno-saturday': require('../../../../assets/demo/posters/poster-void.jpg'),
  'klangkuenstler-berghain': require('../../../../assets/demo/posters/poster-klang.jpg'),
  'fckng-serious': require('../../../../assets/demo/posters/poster-fckng.jpg'),
  'watergate-nights': require('../../../../assets/demo/posters/poster-rhein.jpg'),
  'electric-avenue': require('../../../../assets/demo/posters/poster-void.jpg'),
  'warehouse-pressure': require('../../../../assets/demo/posters/poster-fckng.jpg'),
  'subfloor-session': require('../../../../assets/demo/posters/poster-klang.jpg'),
  'late-night-groove': require('../../../../assets/demo/posters/poster-rhein.jpg'),
  'minimal-drive': require('../../../../assets/demo/posters/poster-gebaeude.jpg'),
  'sisyphos-open-air': require('../../../../assets/demo/posters/poster-gebaeude.jpg'),
  'poster-void': require('../../../../assets/demo/posters/poster-void.jpg'),
  'poster-klang': require('../../../../assets/demo/posters/poster-klang.jpg'),
  'poster-fckng': require('../../../../assets/demo/posters/poster-fckng.jpg'),
  'poster-rhein': require('../../../../assets/demo/posters/poster-rhein.jpg'),
  'poster-gebaeude': require('../../../../assets/demo/posters/poster-gebaeude.jpg'),
  'club-berghain': require('../../../../assets/demo/clubs/club-berghain.jpg'),
  'club-sisyphos': require('../../../../assets/demo/clubs/club-sisyphos.jpg'),
  'club-bootshaus': require('../../../../assets/demo/clubs/club-bootshaus.jpg'),
  'club-about-blank': require('../../../../assets/demo/clubs/club-about-blank.jpg'),
  'club-watergate': require('../../../../assets/demo/clubs/club-watergate.jpg'),
  'staging-seed-event-tonight-house': require('../../../../assets/demo/posters/poster-rhein.jpg'),
  'staging-seed-event-tomorrow-techno': require('../../../../assets/demo/posters/poster-fckng.jpg'),
  'staging-seed-event-weekend-industrial': require('../../../../assets/demo/posters/poster-gebaeude.jpg'),
  'staging-seed-event-weekend-trance': require('../../../../assets/demo/posters/poster-klang.jpg'),
  'staging-seed-event-upcoming-psy': require('../../../../assets/demo/posters/poster-void.jpg'),
  'staging-seed-event-berlin-house': require('../../../../assets/demo/posters/poster-rhein.jpg'),
  'minimal-warehouse': require('../../../../assets/demo/posters/poster-void.jpg'),
  'no-coords-berlin': require('../../../../assets/demo/posters/poster-rhein.jpg'),
};

const FALLBACK_IMAGE = require('../../../../assets/demo/posters/poster-void.jpg');

export function getEventImageAsset(eventId: string, imageAssetKey?: string): ImageSourcePropType {
  const key = imageAssetKey ?? eventId;
  return EVENT_IMAGE_ASSETS[key] ?? FALLBACK_IMAGE;
}

export function getSourceDisplayLabel(source: string): string {
  switch (source) {
    case 'demo':
      return 'Eternal Rave Demo';
    case 'manual':
      return 'Manueller Import';
    case 'local-json':
      return 'Lokale Quelle';
    default:
      return 'Externe Quelle';
  }
}
