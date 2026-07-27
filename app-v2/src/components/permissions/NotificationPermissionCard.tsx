import type { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Stack } from '@/components/layout/Stack';

import { NotificationPreferenceRow } from './NotificationPreferenceRow';
import { PermissionCard } from './PermissionCard';
import { PermissionExplainer } from './PermissionExplainer';
import type { NotificationPreferenceViewModel, PermissionStatus } from '../onboarding/view-models';

export interface NotificationPermissionCardProps {
  status?: PermissionStatus;
  preferences?: NotificationPreferenceViewModel[];
  onAllowPress?: () => void;
  onDenyPress?: () => void;
  onPreferenceChange?: (id: string, enabled: boolean) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Push permission card with optional preference preview rows. */
export function NotificationPermissionCard({
  status = 'not_requested',
  preferences = [],
  onAllowPress,
  onDenyPress,
  onPreferenceChange,
  style,
  testID,
}: NotificationPermissionCardProps) {
  return (
    <Stack gap="md" style={style} testID={testID}>
      <PermissionCard
        permission={{
          kind: 'notifications',
          title: 'Push-Benachrichtigungen',
          description: 'Erhalte Erinnerungen zu gespeicherten Events und Ticket-Updates.',
          status,
          accessibilityLabel: 'Push-Benachrichtigungen',
        }}
        primaryAction={<PrimaryButton label="Benachrichtigungen aktivieren" onPress={onAllowPress} />}
        secondaryAction={<SecondaryButton label="Nicht jetzt" onPress={onDenyPress} />}
      />
      <PermissionExplainer
        title="Warum Benachrichtigungen?"
        description="Ohne Push verpasst du Event-Erinnerungen und Ticket-Updates. Du kannst Kategorien jederzeit anpassen."
        privacyHint="Wir verkaufen deine Daten nicht und versenden keinen Spam."
      />
      {preferences.map((preference) => (
        <NotificationPreferenceRow
          key={preference.id}
          preference={preference}
          onValueChange={(enabled) => onPreferenceChange?.(preference.id, enabled)}
        />
      ))}
    </Stack>
  );
}
