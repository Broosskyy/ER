import type { AdminEventStatus } from '@/data/types/records';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export function useEventStatusLabel(status: AdminEventStatus): string {
  const { t } = useAppTranslation();
  return t(`events.status.${status}`);
}

export function useMyEventsFilterLabel(filter: import('@/features/my-events/utils/my-events-filters').MyEventsFilter): string {
  const { t } = useAppTranslation();
  if (filter === 'all') {
    return t('profile.myEvents.filters.all');
  }
  return t(`profile.myEvents.filters.${filter}`);
}
