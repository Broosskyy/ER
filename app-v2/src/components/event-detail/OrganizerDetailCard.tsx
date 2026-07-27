import { StyleProp, ViewStyle } from 'react-native';

import { OrganizerProfileCard } from '@/components/profiles/OrganizerComponents';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { useTheme } from '@/design/theme';

import type { FollowState } from '@/components/profiles/view-models';
import type { OrganizerDetailViewModel } from './view-models';

export interface OrganizerDetailCardProps {
  detail: OrganizerDetailViewModel;
  followState?: FollowState;
  onFollowPress?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockup 11 organizer row expanded with profile card patterns. */
export function OrganizerDetailCard({
  detail,
  followState,
  onFollowPress,
  onPress,
  style,
  testID,
}: OrganizerDetailCardProps) {
  const { theme } = useTheme();

  return (
    <Section title="Veranstalter" style={style} testID={testID}>
      <OrganizerProfileCard
        organizer={detail.organizer}
        followState={followState}
        onFollowPress={onFollowPress}
        onPress={onPress}
      />
      {detail.moreEventsLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>
          {detail.moreEventsLabel}
        </AppText>
      ) : null}
    </Section>
  );
}
