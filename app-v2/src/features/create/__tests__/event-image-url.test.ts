import { describe, expect, it } from 'vitest';

import {
  isLocalImageUri,
  isPersistableImageUrl,
  resolvePersistableImageUrl,
} from '@/features/create/utils/event-image-url';

describe('event image url helpers', () => {
  it('detects local preview URIs', () => {
    expect(isLocalImageUri('file:///tmp/photo.jpg')).toBe(true);
    expect(isLocalImageUri('content://media/external/images/1')).toBe(true);
    expect(isLocalImageUri('blob:http://localhost/abc')).toBe(true);
    expect(isLocalImageUri('https://example.supabase.co/storage/v1/object/public/events/a.jpg')).toBe(
      false,
    );
  });

  it('accepts only http(s) storage URLs for persistence', () => {
    expect(isPersistableImageUrl('https://cdn.example.com/events/cover.jpg')).toBe(true);
    expect(isPersistableImageUrl('file:///tmp/photo.jpg')).toBe(false);
    expect(isPersistableImageUrl('')).toBe(false);
  });

  it('resolves persistable remote URLs and ignores local previews', () => {
    expect(
      resolvePersistableImageUrl({
        remoteUrl: 'https://cdn.example.com/cover.jpg',
        localUri: 'file:///tmp/cover.jpg',
      }),
    ).toBe('https://cdn.example.com/cover.jpg');

    expect(
      resolvePersistableImageUrl({
        remoteUrl: '',
        localUri: 'file:///tmp/cover.jpg',
      }),
    ).toBeUndefined();
  });
});
