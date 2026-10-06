import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { LocationPermissionState } from '@/components/map/MapLocationStates';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';

import { PermissionCard } from './PermissionCard';
import type { PermissionCardViewModel, PermissionStatus } from '../onboarding/view-models';

export interface LocationPermissionCardProps {
  status?: PermissionStatus;
  onAllowPress?: () => void;
  onDenyPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Location permission card — composes PermissionCard.
 * LocationPermissionState from Phase 2D remains for map-empty contexts.
 */
export function LocationPermissionCard({
  status = 'not_requested',
  onAllowPress,
  onDenyPress,
  style,
  testID,
}: LocationPermissionCardProps) {
  const permission: PermissionCardViewModel = {
    kind: 'location',
    title: 'Standort freigeben',
    description: 'Erhalte Events in deiner Nähe und personalisierte Empfehlungen.',
    status,
    accessibilityLabel: 'Standortfreigabe',
  };

  if (status === 'denied') {
    return (
      <LocationPermissionState
        primaryAction={<PrimaryButton label="Einstellungen öffnen" onPress={onAllowPress} />}
        secondaryAction={<SecondaryButton label="Später" onPress={onDenyPress} />}
      />
    );
  }

  return (
    <PermissionCard
      permission={permission}
      style={style}
      testID={testID}
      primaryAction={<PrimaryButton label="Standort freigeben" onPress={onAllowPress} />}
      secondaryAction={<SecondaryButton label="Nicht jetzt" onPress={onDenyPress} />}
    />
  );
}
