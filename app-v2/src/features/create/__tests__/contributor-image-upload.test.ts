import { describe, expect, it } from 'vitest';

import {
  EVENT_IMAGE_MAX_BYTES,
  isAllowedEventImageMimeType,
} from '@/features/create/constants/event-image-constraints';
import {
  validateEventImageBytes,
  validateEventImageDraft,
} from '@/features/create/services/contributor-image-upload-service';

describe('contributor image upload validation', () => {
  it('accepts allowed mime types', () => {
    expect(isAllowedEventImageMimeType('image/jpeg')).toBe(true);
    expect(isAllowedEventImageMimeType('image/png')).toBe(true);
    expect(isAllowedEventImageMimeType('image/gif')).toBe(false);
  });

  it('rejects invalid image drafts', () => {
    const result = validateEventImageDraft({
      remoteUrl: '',
      localUri: 'file:///tmp/test.gif',
      mimeType: 'image/gif',
    });
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe('create.event.errors.imageTypeInvalid');
  });

  it('rejects files above the size limit', () => {
    const result = validateEventImageBytes(EVENT_IMAGE_MAX_BYTES + 1);
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe('create.event.errors.imageTooLarge');
  });
});
