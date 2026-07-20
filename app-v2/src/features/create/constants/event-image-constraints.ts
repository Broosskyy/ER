export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const EVENT_IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type EventImageMimeType = (typeof EVENT_IMAGE_ALLOWED_MIME_TYPES)[number];

export function isAllowedEventImageMimeType(mimeType: string): mimeType is EventImageMimeType {
  return (EVENT_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}
