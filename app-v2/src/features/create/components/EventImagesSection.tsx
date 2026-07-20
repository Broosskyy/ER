import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import { spacing } from '@/design/spacing';
import { EventImageUpload } from '@/features/create/components/EventImageUpload';
import {
  validateEventImageBytes,
  validateEventImageDraft,
} from '@/features/create/services/contributor-image-upload-service';
import type { EventImageField, EventImageDraft } from '@/features/create/types/event-draft-form';
import { pickEventImage, toEventImageDraft } from '@/features/create/utils/event-image-picker';
import { getAllowedEventImageMimeTypesLabel } from '@/features/create/services/contributor-image-upload-service';

export interface EventImagesSectionLabels {
  cover: string;
  flyer: string;
  coverHelper: string;
  flyerHelper: string;
  add: string;
  replace: string;
  remove: string;
  hint: string;
}

export interface EventImagesSectionProps {
  coverImage: EventImageDraft | null;
  flyerImage: EventImageDraft | null;
  labels: EventImagesSectionLabels;
  disabled?: boolean;
  coverError?: string;
  flyerError?: string;
  onImageChange: (field: EventImageField, value: EventImageDraft | null) => void;
  onImageError: (field: EventImageField, message: string | undefined) => void;
  translateError: (key?: string) => string | undefined;
}

export function EventImagesSection({
  coverImage,
  flyerImage,
  labels,
  disabled,
  coverError,
  flyerError,
  onImageChange,
  onImageError,
  translateError,
}: EventImagesSectionProps) {
  const imageLabels = {
    add: labels.add,
    replace: labels.replace,
    remove: labels.remove,
    hint: labels.hint.replace('{{types}}', getAllowedEventImageMimeTypesLabel()),
  };

  const handlePick = useCallback(
    async (field: EventImageField) => {
      const picked = await pickEventImage();
      if (!picked) {
        return;
      }

      const draft = toEventImageDraft(picked);
      const typeValidation = validateEventImageDraft(draft);
      if (!typeValidation.valid) {
        onImageError(field, translateError(typeValidation.errorKey));
        return;
      }

      if (picked.byteLength !== undefined) {
        const sizeValidation = validateEventImageBytes(picked.byteLength);
        if (!sizeValidation.valid) {
          onImageError(field, translateError(sizeValidation.errorKey));
          return;
        }
      }

      onImageError(field, undefined);
      onImageChange(field, draft);
    },
    [onImageChange, onImageError, translateError],
  );

  return (
    <View style={styles.container}>
      <EventImageUpload
        label={labels.cover}
        helper={labels.coverHelper}
        error={coverError}
        image={coverImage}
        labels={imageLabels}
        disabled={disabled}
        onPick={() => void handlePick('coverImage')}
        onRemove={() => onImageChange('coverImage', null)}
      />
      <EventImageUpload
        label={labels.flyer}
        helper={labels.flyerHelper}
        error={flyerError}
        image={flyerImage}
        labels={imageLabels}
        disabled={disabled}
        onPick={() => void handlePick('flyerImage')}
        onRemove={() => onImageChange('flyerImage', null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
});
