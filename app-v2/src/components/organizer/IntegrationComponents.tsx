import { StyleSheet, View, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { Badge } from '@/components/feedback/Badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { resolveIntegrationBadgeStatus, resolveIntegrationStatusLabel } from './organizer-styles';
import type { IntegrationStatus, IntegrationViewModel } from './view-models';

export interface IntegrationStatusBadgeProps {
  status: IntegrationStatus;
  style?: ViewStyle;
  testID?: string;
}

export function IntegrationStatusBadge({ status, style, testID }: IntegrationStatusBadgeProps) {
  return (
    <Badge
      label={resolveIntegrationStatusLabel(status)}
      status={resolveIntegrationBadgeStatus(status)}
      style={style}
      testID={testID}
    />
  );
}

export interface IntegrationCardProps {
  integration: IntegrationViewModel;
  onConnectPress?: () => void;
  onDisconnectPress?: () => void;
  onConfigurePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 40 integration card. */
export function IntegrationCard({
  integration,
  onConnectPress,
  onDisconnectPress,
  onConfigurePress,
  style,
  testID,
}: IntegrationCardProps) {
  const { theme } = useTheme();
  const connectAction =
    integration.status === 'connected' ? onDisconnectPress : onConnectPress;
  const connectLabel = integration.status === 'connected' ? 'Trennen' : 'Verbinden';

  const content = (
    <CardFoundation padding="md" style={styles.integrationCard}>
      <View style={styles.integrationHeader}>
        <View style={[styles.integrationIcon, { backgroundColor: theme.colors.accentMuted }]}>
          <AppIcon name="link-outline" color={theme.colors.accent} />
        </View>
        <View style={styles.integrationCopy}>
          <AppText role="cardTitle">{integration.name}</AppText>
          {integration.description ? (
            <AppText role="bodyMuted" color={theme.colors.textSecondary}>{integration.description}</AppText>
          ) : null}
          {integration.lastSyncLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary}>
              Letzte Synchronisierung: {integration.lastSyncLabel}
            </AppText>
          ) : null}
        </View>
        <IntegrationStatusBadge status={integration.status} />
      </View>
      <Stack direction="horizontal" gap="sm" style={styles.integrationActions}>
        {connectAction ? <PrimaryButton label={connectLabel} onPress={connectAction} /> : null}
        {onConfigurePress ? <SecondaryButton label="Konfigurieren" onPress={onConfigurePress} /> : null}
      </Stack>
    </CardFoundation>
  );

  return (
    <View style={style} testID={testID} accessibilityLabel={integration.accessibilityLabel}>
      {content}
    </View>
  );
}

export interface IntegrationSyncRowProps {
  lastSyncLabel?: string;
  importedEventsLabel?: string;
  errorLabel?: string;
  warningLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

export function IntegrationSyncRow({
  lastSyncLabel,
  importedEventsLabel,
  errorLabel,
  warningLabel,
  style,
  testID,
}: IntegrationSyncRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.syncRow, style]} testID={testID}>
      {lastSyncLabel ? <AppText role="caption" color={theme.colors.textSecondary}>Sync: {lastSyncLabel}</AppText> : null}
      {importedEventsLabel ? <AppText role="caption" color={theme.colors.textSecondary}>Importiert: {importedEventsLabel}</AppText> : null}
      {errorLabel ? <AppText role="caption" color={theme.colors.destructive}>{errorLabel}</AppText> : null}
      {warningLabel ? <AppText role="caption" color={theme.colors.warning}>{warningLabel}</AppText> : null}
    </View>
  );
}

export interface IntegrationEmptyStateProps {
  onAddPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function IntegrationEmptyState({ onAddPress, style, testID }: IntegrationEmptyStateProps) {
  return (
    <EmptyState
      title="Keine Integrationen"
      description="Verbinde Ticketplattformen oder Social-Kanäle, um deine Events zu erweitern."
      icon="link-outline"
      primaryAction={onAddPress ? <PrimaryButton label="Integration hinzufügen" onPress={onAddPress} /> : undefined}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  integrationCard: { gap: spacing.md },
  integrationHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  integrationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationCopy: { flex: 1, gap: spacing.xs },
  integrationActions: { flexWrap: 'wrap' },
  syncRow: { gap: spacing.xs },
});
