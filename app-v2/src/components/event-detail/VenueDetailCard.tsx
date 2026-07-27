import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { CardFoundation } from '@/components/cards/CardFoundation';
import { EventMetaRow } from '@/components/discovery/EventMetaRow';
import { VenueRow } from '@/components/discovery/VenueRow';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { VerificationBadge } from '@/components/profiles/VerificationBadge';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { VenueDetailViewModel } from './view-models';

export interface VenueDetailCardProps {
  venue: VenueDetailViewModel;
  onPress?: () => void;
  onDirectionsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockup 11 venue block with optional directions action. */
export function VenueDetailCard({
  venue,
  onPress,
  onDirectionsPress,
  style,
  testID,
}: VenueDetailCardProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" onPress={onPress} style={style} testID={testID}>
      <VenueRow
        venue={{
          id: venue.id,
          name: venue.name,
          image: venue.image,
          cityLabel: venue.cityLabel,
          subtitleLabel: venue.addressLabel,
          verified: venue.verified,
          accessibilityLabel: venue.accessibilityLabel,
        }}
      />
      {venue.verified ? <VerificationBadge status="verified" /> : null}
      {venue.descriptionLabel ? (
        <AppText role="bodyMuted" color={theme.colors.textSecondary}>
          {venue.descriptionLabel}
        </AppText>
      ) : null}
      <EventMetaRow icon="location-outline" label="Adresse" value={venue.addressLabel} />
      {onDirectionsPress ? (
        <PrimaryButton label="Route planen" onPress={onDirectionsPress} />
      ) : null}
    </CardFoundation>
  );
}
