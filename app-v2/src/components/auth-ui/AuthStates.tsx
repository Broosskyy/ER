import { ActivityIndicator, ViewStyle } from 'react-native';

import { Banner } from '@/components/feedback/Banner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Stack } from '@/components/layout/Stack';
import { useTheme } from '@/design/theme';

export interface AuthLoadingStateProps {
  style?: ViewStyle;
  testID?: string;
}

export function AuthLoadingState({ style, testID }: AuthLoadingStateProps) {
  const { theme } = useTheme();

  return (
    <Stack gap="md" style={style} testID={testID}>
      <ActivityIndicator color={theme.colors.accent} />
      <Skeleton shape="text" width="60%" />
      <Skeleton shape="card" height={48} />
      <Skeleton shape="card" height={48} />
    </Stack>
  );
}

export interface AuthErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function AuthErrorState({
  title = 'Anmeldung fehlgeschlagen',
  message = 'Bitte überprüfe deine Eingaben und versuche es erneut.',
  onRetry,
  style,
  testID,
}: AuthErrorStateProps) {
  return (
    <Stack gap="md" style={style} testID={testID}>
      <Banner title={title} message={message} variant="error" />
      <EmptyState
        title="Auth-Fehler"
        description={message}
        icon="alert-circle-outline"
        primaryAction={onRetry ? <PrimaryButton label="Erneut versuchen" onPress={onRetry} /> : undefined}
      />
    </Stack>
  );
}
