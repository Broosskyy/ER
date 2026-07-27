import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/feedback/Banner';
import { EventHero } from '@/components/event-detail/EventHero';
import { EventInfoSection } from '@/components/event-detail/EventInfoSection';
import { EventNoticeBanner } from '@/components/event-detail/EventNoticeBanner';
import { EventTicketSection } from '@/components/event-detail/EventTicketSection';
import { ExpandableText } from '@/components/event-detail/ExpandableText';
import { LineupSection } from '@/components/event-detail/LineupSection';
import { OrganizerDetailCard } from '@/components/event-detail/OrganizerDetailCard';
import { VenueDetailCard } from '@/components/event-detail/VenueDetailCard';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import {
  toEventHeroViewModel,
  toEventInfoViewModel,
  toEventTicketSectionViewModel,
  toLineupSectionViewModel,
  toOrganizerDetailViewModel,
  toVenueDetailViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';

import { buildPreviewAdminRecord, buildPreviewDisplayModel } from '@/features/create/wizard/wizard-preview-mapper';
import type { EventFormData } from '@/features/create/wizard/wizard-types';

export interface EventWizardDetailPreviewProps {
  formData: EventFormData;
  eventId: string;
  userId: string;
}

export function EventWizardDetailPreview({
  formData,
  eventId,
  userId,
}: EventWizardDetailPreviewProps) {
  const record = buildPreviewAdminRecord(formData, eventId, userId);
  const event = buildPreviewDisplayModel(record, formData);

  return (
    <Stack gap="md" style={styles.container}>
      <Banner
        title="Vorschau"
        message="So kann dein Event nach der Veröffentlichung aussehen. Externe Aktionen sind deaktiviert."
        variant="info"
      />
      <EventHero event={toEventHeroViewModel(event)} />
      <EventInfoSection info={toEventInfoViewModel(event)} />
      {event.description ? <ExpandableText text={event.description} /> : null}
      {toLineupSectionViewModel(event) ? (
        <LineupSection lineup={toLineupSectionViewModel(event)!} />
      ) : null}
      <VenueDetailCard venue={toVenueDetailViewModel(event)} />
      {toOrganizerDetailViewModel(event) ? (
        <OrganizerDetailCard detail={toOrganizerDetailViewModel(event)!} />
      ) : null}
      <EventTicketSection section={toEventTicketSectionViewModel(event)} />
      {formData.extension.awarenessNotes ? (
        <EventNoticeBanner
          notice={{
            type: 'general',
            title: 'Hinweise',
            message: formData.extension.awarenessNotes,
          }}
        />
      ) : null}
      <View />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.lg,
  },
});
