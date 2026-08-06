import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { EventMetaRow } from '@/components/discovery/EventMetaRow';
import { VenueRow } from '@/components/discovery/VenueRow';
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

/** Mockup 11 venue block with route action below content on mobile-friendly layout. */
export function VenueDetailCard({
  venue,
  onPress,
  onDirectionsPress,
  style,
  testID,
}: VenueDetailCardProps) {
  const { theme } = useTheme();
  const normalizedAddress = venue.addressLabel?.trim();
  const cityLabel = venue.cityLabel?.trim();
  const showCityRow =
    cityLabel &&
    cityLabel.toLowerCase() !== venue.name.trim().toLowerCase();
  const showStreetRow =
    normalizedAddress &&
    normalizedAddress.toLowerCase() !== venue.name.trim().toLowerCase() &&
    normalizedAddress.toLowerCase() !== cityLabel?.toLowerCase() &&
    !normalizedAddress.toLowerCase().startsWith(venue.name.trim().toLowerCase()) &&
    !(cityLabel && normalizedAddress.toLowerCase().endsWith(cityLabel.toLowerCase()));

  const body = (
    <CardFoundation padding="md" style={styles.card} testID={onPress ? undefined : testID}>
      <VenueRow
        venue={{
          id: venue.id,
          name: venue.name,
          image: venue.image,
          cityLabel: showCityRow ? '' : cityLabel ?? '',
          subtitleLabel: undefined,
          verified: venue.verified,
          accessibilityLabel: venue.accessibilityLabel,
        }}
      />
      {venue.verified ? <VerificationBadge status="official_source" /> : null}
      {venue.descriptionLabel ? (
        <AppText role="bodyMuted" color={theme.colors.textSecondary}>
          {venue.descriptionLabel}
        </AppText>
      ) : null}
      {showStreetRow ? (
        <EventMetaRow icon="location-outline" label="Adresse" value={normalizedAddress} />
      ) : null}
      {showCityRow ? (
        <EventMetaRow icon="navigate-outline" label="Stadt" value={cityLabel} />
      ) : null}
    </CardFoundation>
  );

  const directionsAction = onDirectionsPress ? (
    <View style={styles.directions}>
      <PrimaryButton label="Route planen" onPress={onDirectionsPress} />
    </View>
  ) : null;

  if (!onPress) {
    return (
      <View style={[styles.root, style]} testID={testID}>
        {body}
        {directionsAction}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]} testID={testID}>
      <InteractiveCard
        onPress={onPress}
        accessibilityLabel={venue.accessibilityLabel}
        pressableStyle={styles.pressable}
      >
        {body}
      </InteractiveCard>
      {directionsAction}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  pressable: {
    width: '100%',
  },
  directions: {
    width: '100%',
  },
});
