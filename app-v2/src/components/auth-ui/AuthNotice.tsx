import { Banner } from '@/components/feedback/Banner';
import type { ViewStyle } from 'react-native';

import { resolveAuthNoticeBannerVariant, type AuthNoticeKind } from '../onboarding/onboarding-styles';

export interface AuthNoticeProps {
  kind: AuthNoticeKind;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Auth feedback notices — reuses Banner. */
export function AuthNotice({
  kind,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  style,
  testID,
}: AuthNoticeProps) {
  return (
    <Banner
      title={title}
      message={message}
      variant={resolveAuthNoticeBannerVariant(kind)}
      actionLabel={actionLabel}
      onAction={onAction}
      dismissible={Boolean(onDismiss)}
      onDismiss={onDismiss}
      style={style}
      testID={testID}
    />
  );
}
