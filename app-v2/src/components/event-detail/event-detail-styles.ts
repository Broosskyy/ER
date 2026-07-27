import type { BannerVariant } from '@/components/feedback/banner-styles';

import type { EventNoticeType } from './view-models';

const noticeVariants: Record<EventNoticeType, BannerVariant> = {
  cancelled: 'error',
  postponed: 'warning',
  venue_changed: 'warning',
  time_changed: 'warning',
  sold_out: 'error',
  age_restriction: 'info',
  general: 'info',
};

const noticeTitles: Record<EventNoticeType, string> = {
  cancelled: 'Event abgesagt',
  postponed: 'Event verschoben',
  venue_changed: 'Venue geändert',
  time_changed: 'Zeit geändert',
  sold_out: 'Ausverkauft',
  age_restriction: 'Altersbeschränkung',
  general: 'Hinweis',
};

export function resolveEventNoticeVariant(type: EventNoticeType): BannerVariant {
  return noticeVariants[type];
}

export function resolveEventNoticeTitle(type: EventNoticeType): string {
  return noticeTitles[type];
}
