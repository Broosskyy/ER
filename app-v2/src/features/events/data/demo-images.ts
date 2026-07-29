export { EVENT_IMAGE_ASSETS, getEventImageAsset } from './demo-image-assets';
export { resolveEventImageSource } from './event-image-resolver';

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
