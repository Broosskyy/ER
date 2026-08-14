import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen } from '@/components';
import { EventNotFoundState } from '@/features/event-detail';
import { navigateBackSafely } from '@/features/navigation/safe-back-navigation';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <AppScreen>
        <EventNotFoundState onGoBack={() => navigateBackSafely(router)} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <EventNotFoundState onGoBack={() => navigateBackSafely(router)} />
    </AppScreen>
  );
}
