import { AppError } from '@/core/errors/app-error';
import { featureFlags } from '@/core/config/feature-flags';
import {
  EVENT_IMAGE_ALLOWED_MIME_TYPES,
  EVENT_IMAGE_MAX_BYTES,
  extensionForMimeType,
  isAllowedEventImageMimeType,
} from '@/features/create/constants/event-image-constraints';
import type { EventImageDraft } from '@/features/create/types/event-draft-form';
import { isPersistableImageUrl } from '@/features/create/utils/event-image-url';
import { getSupabaseClient } from '@/services/supabase/client';

export interface EventImageUploadInput {
  userId: string;
  eventId: string;
  kind: 'cover' | 'flyer';
  image: EventImageDraft;
}

export interface EventImageValidationResult {
  valid: boolean;
  errorKey?: 'create.event.errors.imageTypeInvalid' | 'create.event.errors.imageTooLarge';
}

export function validateEventImageDraft(image: EventImageDraft): EventImageValidationResult {
  if (image.mimeType && !isAllowedEventImageMimeType(image.mimeType)) {
    return { valid: false, errorKey: 'create.event.errors.imageTypeInvalid' };
  }

  return { valid: true };
}

export function validateEventImageBytes(byteLength: number): EventImageValidationResult {
  if (byteLength > EVENT_IMAGE_MAX_BYTES) {
    return { valid: false, errorKey: 'create.event.errors.imageTooLarge' };
  }

  return { valid: true };
}

function buildStoragePath(userId: string, eventId: string, kind: string, mimeType: string): string {
  const extension = extensionForMimeType(mimeType);
  return `${userId}/${eventId}/${kind}.${extension}`;
}

async function fetchBlobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new AppError('Failed to read image file.', { code: 'VALIDATION' });
  }
  return response.blob();
}

function assertPersistableUploadResult(url: string): string {
  if (!isPersistableImageUrl(url)) {
    throw new AppError('Image upload did not return a valid storage URL.', {
      code: 'VALIDATION',
      cause: 'create.event.errors.imageUploadFailed',
    });
  }

  return url;
}

export class ContributorImageUploadService {
  /**
   * Uploads a pending local image to storage.
   * Returns a persistable https URL, or empty string when upload is unavailable.
   * Never returns file://, content://, or blob: URIs.
   */
  async uploadEventImage(input: EventImageUploadInput): Promise<string> {
    const { image } = input;

    if (isPersistableImageUrl(image.remoteUrl)) {
      return image.remoteUrl;
    }

    if (!image.localUri) {
      return '';
    }

    const mimeType = image.mimeType ?? 'image/jpeg';
    const validation = validateEventImageDraft({ ...image, mimeType });
    if (!validation.valid) {
      throw new AppError('Invalid image type.', {
        code: 'VALIDATION',
        cause: validation.errorKey,
      });
    }

    if (!featureFlags.useSupabase) {
      return '';
    }

    const blob = await fetchBlobFromUri(image.localUri);
    const sizeValidation = validateEventImageBytes(blob.size);
    if (!sizeValidation.valid) {
      throw new AppError('Image file is too large.', {
        code: 'VALIDATION',
        cause: sizeValidation.errorKey,
      });
    }

    const path = buildStoragePath(input.userId, input.eventId, input.kind, mimeType);
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from('events').upload(path, blob, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
    }

    const { data } = supabase.storage.from('events').getPublicUrl(path);
    return assertPersistableUploadResult(data.publicUrl);
  }
}

export const contributorImageUploadService = new ContributorImageUploadService();

export function getAllowedEventImageMimeTypesLabel(): string {
  return EVENT_IMAGE_ALLOWED_MIME_TYPES.map((type) => type.replace('image/', '').toUpperCase()).join(', ');
}
