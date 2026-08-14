import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen } from '@/components';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  EventDetailContent,
  EventDetailLoadingState,
} from '@/features/event-detail/components/EventDetailContent';
import { EventNotFoundState } from '@/features/event-detail';
import { useEventCoreDetail } from '@/features/events/hooks/useEventCoreDetail';
import { navigateBackSafely } from '@/features/navigation/safe-back-navigation';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useEventCoreDetail(id);

  if (!id || state.status === 'not_found') {
    return (
      <AppScreen>
        <EventNotFoundState onGoBack={() => navigateBackSafely(router)} />
      </AppScreen>
    );
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <AppScreen>
        <EventDetailLoadingState />
      </AppScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <AppScreen>
        <EmptyState title="Event nicht verfügbar" description={state.message} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <EventDetailContent detail={state.detail} display={state.display} />
    </AppScreen>
  );
}
