import { useMemo } from 'react';

import type { EventDraftFormLabels } from '@/features/create/components/EventDraftForm';
import type { EventImagesSectionLabels } from '@/features/create/components/EventImagesSection';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export function useEventDraftFormLabels(mode: 'create' | 'edit'): {
  formLabels: EventDraftFormLabels;
  imageLabels: EventImagesSectionLabels;
} {
  const { t } = useAppTranslation();

  return useMemo(() => {
    const formLabels: EventDraftFormLabels = {
      title: mode === 'create' ? t('create.event.form.title') : t('create.event.form.editTitle'),
      subtitle:
        mode === 'create' ? t('create.event.form.subtitle') : t('create.event.form.editSubtitle'),
      fields: {
        title: t('create.event.form.labels.title'),
        startDate: t('create.event.form.labels.startDate'),
        startTime: t('create.event.form.labels.startTime'),
        endDate: t('create.event.form.labels.endDate'),
        endTime: t('create.event.form.labels.endTime'),
        venueId: t('create.event.form.labels.venue'),
        venueText: t('create.event.form.labels.venue'),
        genreId: t('create.event.form.labels.genre'),
        description: t('create.event.form.labels.description'),
        ticketUrl: t('create.event.form.labels.ticketUrl'),
        websiteUrl: t('create.event.form.labels.website'),
        instagramUrl: t('create.event.form.labels.instagram'),
        facebookUrl: t('create.event.form.labels.facebook'),
        coverImage: t('create.event.form.labels.coverImage'),
        flyerImage: t('create.event.form.labels.flyerImage'),
      },
      helpers: {
        title: t('create.event.form.helpers.title'),
        startDate: t('create.event.form.helpers.startDate'),
        startTime: t('create.event.form.helpers.startTime'),
        endDate: t('create.event.form.helpers.endDate'),
        endTime: t('create.event.form.helpers.endTime'),
        venueText: t('create.event.form.helpers.venue'),
        genreId: t('create.event.form.helpers.genre'),
        description: t('create.event.form.helpers.description'),
        ticketUrl: t('create.event.form.helpers.ticketUrl'),
        websiteUrl: t('create.event.form.helpers.website'),
        instagramUrl: t('create.event.form.helpers.instagram'),
        facebookUrl: t('create.event.form.helpers.facebook'),
      },
      placeholders: {
        title: t('create.event.form.placeholders.title'),
        date: t('create.event.form.placeholders.date'),
        time: t('create.event.form.placeholders.time'),
        venue: t('create.event.form.placeholders.venue'),
        description: t('create.event.form.placeholders.description'),
      },
      venueFreeTextHint: t('create.event.form.helpers.venueFreeText'),
      optionalFieldLabel: t('create.event.form.labels.optional'),
      submit: t('create.event.form.actions.saveDraft'),
      submitting: t('create.event.form.actions.saving'),
      preview: t('create.event.form.actions.preview'),
    };

    const imageLabels: EventImagesSectionLabels = {
      cover: t('create.event.form.labels.coverImage'),
      flyer: t('create.event.form.labels.flyerImage'),
      coverHelper: t('create.event.form.helpers.coverImage'),
      flyerHelper: t('create.event.form.helpers.flyerImage'),
      add: t('create.event.form.images.add'),
      replace: t('create.event.form.images.replace'),
      remove: t('create.event.form.images.remove'),
      hint: t('create.event.form.images.hint'),
    };

    return { formLabels, imageLabels };
  }, [mode, t]);
}
