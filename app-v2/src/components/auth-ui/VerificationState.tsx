import type { ReactNode } from 'react';
import { ViewStyle } from 'react-native';

import { Banner } from '@/components/feedback/Banner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Stack } from '@/components/layout/Stack';

import type { VerificationStateViewModel } from '../onboarding/view-models';

export interface VerificationStateProps {
  state: VerificationStateViewModel;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  onResend?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const stateIcons = {
  email_sent: 'mail-outline' as const,
  pending: 'hourglass-outline' as const,
  verified: 'checkmark-circle-outline' as const,
  expired: 'time-outline' as const,
  error: 'alert-circle-outline' as const,
};

const stateBannerVariant = {
  email_sent: 'success' as const,
  pending: 'warning' as const,
  verified: 'success' as const,
  expired: 'error' as const,
  error: 'error' as const,
};

/** Email verification UI states — no email API. */
export function VerificationState({
  state,
  primaryAction,
  secondaryAction,
  onResend,
  style,
  testID,
}: VerificationStateProps) {
  return (
    <Stack gap="md" style={style} testID={testID}>
      <Banner
        title={state.title}
        message={state.description}
        variant={stateBannerVariant[state.state]}
      />
      <EmptyState
        title={state.title}
        description={state.description}
        icon={stateIcons[state.state]}
        primaryAction={primaryAction ?? (onResend ? <PrimaryButton label="E-Mail erneut senden" onPress={onResend} /> : undefined)}
        secondaryAction={secondaryAction ?? <SecondaryButton label="Zurück zum Login" onPress={() => undefined} />}
      />
      {state.emailLabel ? (
        <Banner title="Gesendet an" message={state.emailLabel} variant="info" />
      ) : null}
    </Stack>
  );
}
