import { Banner } from '@/components/feedback/Banner';
import type { ViewStyle } from 'react-native';

import { resolveEventNoticeTitle, resolveEventNoticeVariant } from './event-detail-styles';
import type { EventNoticeViewModel } from './view-models';

export interface EventNoticeBannerProps {
  notice: EventNoticeViewModel;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Important event notices — reuses Banner without event mutation. */
export function EventNoticeBanner({
  notice,
  onAction,
  actionLabel,
  onDismiss,
  style,
  testID,
}: EventNoticeBannerProps) {
  return (
    <Banner
      title={notice.title || resolveEventNoticeTitle(notice.type)}
      message={notice.message}
      variant={resolveEventNoticeVariant(notice.type)}
      actionLabel={actionLabel}
      onAction={onAction}
      dismissible={Boolean(onDismiss)}
      onDismiss={onDismiss}
      style={style}
      testID={testID}
    />
  );
}
