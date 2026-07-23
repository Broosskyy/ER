import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import { connectorAdminService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { canManageConnectors } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { formatConnectorHealthStatus } from '@/features/connectors/admin/connector-labels';
import type { ConnectorAdminListItem, ConnectorFrameworkDiagnosticsView } from '@/features/connectors/services/connector-admin-service';
import type { ConnectorGlobalFrameworkSettings } from '@/features/connectors/domain/connector-config';

export default function AdminConnectorsScreen() {
  const router = useRouter();
  const { role } = useAdminAuth();
  const canEdit = canManageConnectors(role);
  const [connectors, setConnectors] = useState<ConnectorAdminListItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<ConnectorFrameworkDiagnosticsView | null>(null);
  const [globalSettings, setGlobalSettings] = useState<ConnectorGlobalFrameworkSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, diag, global] = await Promise.all([
        connectorAdminService.listForAdmin(role),
        connectorAdminService.getDiagnostics(role),
        connectorAdminService.getGlobalSettings(role),
      ]);
      setConnectors(items);
      setDiagnostics(diag);
      setGlobalSettings(global);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const saveGlobalSettings = async () => {
    if (!globalSettings || !canEdit) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await connectorAdminService.updateGlobalSettings(role, globalSettings);
      setGlobalSettings(saved);
      setSuccess('Global connector settings saved.');
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !diagnostics) {
    return <AdminLoadingState label="Loading connectors…" />;
  }

  if (error && !diagnostics) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>Connectors</AppText>
          </View>

          <View style={styles.banner}>
            <AppText style={styles.bannerTitle}>Framework Ready</AppText>
            <AppText style={styles.meta}>
              Configuration only. Connector execution is not yet available.
            </AppText>
          </View>

          {error ? (
            <AppText style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          {success ? (
            <AppText style={styles.success} accessibilityLiveRegion="polite">
              {success}
            </AppText>
          ) : null}

          {diagnostics ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.sectionTitle}>Diagnostics</AppText>
              <AppText style={styles.meta}>
                Registered connectors: {diagnostics.registeredCount}
              </AppText>
              <AppText style={styles.meta}>
                Execution available: {diagnostics.executionAvailable ? 'Yes' : 'No'}
              </AppText>
              {diagnostics.registryIssues.length > 0 ? (
                <AppText style={styles.error}>
                  Registry issues: {diagnostics.registryIssues.map((issue) => issue.message).join(' ')}
                </AppText>
              ) : (
                <AppText style={styles.meta}>Registry integrity: OK</AppText>
              )}
              {diagnostics.configurationIssues.length > 0 ? (
                <AppText style={styles.error}>
                  Configuration issues:{' '}
                  {diagnostics.configurationIssues.map((issue) => issue.message).join(' ')}
                </AppText>
              ) : (
                <AppText style={styles.meta}>Configuration: Complete</AppText>
              )}
            </View>
          ) : null}

          {globalSettings ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.sectionTitle}>Global Framework Settings</AppText>
              <AppText style={styles.meta}>{globalSettings.frameworkReadyMessage}</AppText>
              <View style={styles.toggleRow}>
                <SecondaryButton
                  label={globalSettings.enabled ? 'Framework enabled' : 'Framework disabled'}
                  onPress={() =>
                    canEdit &&
                    setGlobalSettings({ ...globalSettings, enabled: !globalSettings.enabled })
                  }
                  style={globalSettings.enabled ? styles.chipActive : undefined}
                  disabled={!canEdit}
                />
                <SecondaryButton
                  label={globalSettings.diagnosticsEnabled ? 'Diagnostics on' : 'Diagnostics off'}
                  onPress={() =>
                    canEdit &&
                    setGlobalSettings({
                      ...globalSettings,
                      diagnosticsEnabled: !globalSettings.diagnosticsEnabled,
                    })
                  }
                  style={globalSettings.diagnosticsEnabled ? styles.chipActive : undefined}
                  disabled={!canEdit}
                />
              </View>
              <AppText style={styles.label}>Default timeout (ms)</AppText>
              <TextInput
                value={String(globalSettings.defaultTimeoutMs)}
                editable={canEdit}
                keyboardType="numeric"
                onChangeText={(value) =>
                  setGlobalSettings({
                    ...globalSettings,
                    defaultTimeoutMs: Number(value) || 0,
                  })
                }
                style={styles.input}
                accessibilityLabel="Default connector timeout in milliseconds"
              />
              <AppText style={styles.label}>Max retries (placeholder)</AppText>
              <TextInput
                value={String(globalSettings.maxRetries)}
                editable={canEdit}
                keyboardType="numeric"
                onChangeText={(value) =>
                  setGlobalSettings({
                    ...globalSettings,
                    maxRetries: Number(value) || 0,
                  })
                }
                style={styles.input}
                accessibilityLabel="Maximum connector retries placeholder"
              />
              <AppText style={styles.label}>Authentication placeholder</AppText>
              <TextInput
                value={globalSettings.authenticationMechanismPlaceholder ?? ''}
                editable={canEdit}
                onChangeText={(value) =>
                  setGlobalSettings({
                    ...globalSettings,
                    authenticationMechanismPlaceholder: value,
                  })
                }
                style={styles.input}
                accessibilityLabel="Authentication mechanism placeholder"
                placeholder="Future authentication provider"
                placeholderTextColor={colorRoles.emptyStateDescription}
              />
              {canEdit ? (
                <PrimaryButton
                  label={saving ? 'Saving…' : 'Save global settings'}
                  onPress={() => void saveGlobalSettings()}
                  disabled={saving}
                />
              ) : null}
            </View>
          ) : null}

          <AppText style={styles.sectionTitle}>Connector Registry</AppText>

          {connectors.length === 0 ? (
            <AdminEmptyState
              title="No connectors registered"
              description="The framework is ready. Provider connectors will appear here when registered in future epics."
            />
          ) : (
            <FlatList
              data={connectors}
              keyExtractor={(item) => item.connectorKey}
              scrollEnabled={false}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    router.push(`/admin/connectors/${item.connectorKey}` as `/admin/events/${string}`)
                  }
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`Connector ${item.displayName}`}
                >
                  <AppText style={styles.cardTitle}>{item.displayName}</AppText>
                  <AppText style={styles.meta}>Key: {item.connectorKey}</AppText>
                  {item.version ? <AppText style={styles.meta}>Version: {item.version}</AppText> : null}
                  <AppText style={styles.meta}>
                    Health: {formatConnectorHealthStatus(item.healthStatus)}
                  </AppText>
                  <AppText style={styles.meta}>Capabilities: {item.capabilitySummary}</AppText>
                  <AppText style={styles.meta}>
                    Endpoints: {item.supportedEndpointTypes.join(', ') || 'Not declared'}
                  </AppText>
                </Pressable>
              )}
            />
          )}
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...textRoles.screenTitle, flex: 1 },
  banner: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  bannerTitle: { ...textRoles.sectionTitle },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { ...textRoles.sectionTitle },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  label: { ...textRoles.label },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipActive: { borderColor: colors.primary, borderWidth: 2 },
  list: { gap: spacing.sm },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 44,
  },
  cardTitle: { ...textRoles.cardTitle },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
});
