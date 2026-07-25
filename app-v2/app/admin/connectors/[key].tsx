import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canManageConnectors } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  formatConnectorHealthStatus,
  formatConnectorLifecycleState,
} from '@/features/connectors/admin/connector-labels';
import type { ConnectorAdminDetail } from '@/features/connectors/services/connector-admin-service';

export default function AdminConnectorDetailScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { role } = useAdminAuth();
  const canEdit = canManageConnectors(role);
  const [detail, setDetail] = useState<ConnectorAdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!key) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loaded = await connectorAdminService.getConnectorDetail(role, key);
      setDetail(loaded);
    } catch (cause) {
      setError(getErrorMessage(cause));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [key, role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleSave = async () => {
    if (!detail || !canEdit) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await connectorAdminService.updateConnectorSettings(
        role,
        detail.connectorKey,
        detail.settings,
      );
      setDetail(saved);
      setSuccess('Connector configuration saved.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading connector…" />;
  }

  if (error && !detail) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  if (!detail) {
    return <AdminErrorState message="Connector not found." onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{detail.displayName}</AppText>
          </View>

          <View style={styles.banner}>
            <AppText style={styles.bannerTitle}>Execution Not Yet Available</AppText>
            <AppText style={styles.meta}>
              Review configuration and capabilities only. Acquisition will be enabled in a future epic.
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

          <View style={styles.summaryCard}>
            <AppText style={styles.sectionTitle}>Overview</AppText>
            <AppText style={styles.meta}>Key: {detail.connectorKey}</AppText>
            <AppText style={styles.meta}>Version: {detail.version ?? 'Not declared'}</AppText>
            <AppText style={styles.meta}>
              Lifecycle: {formatConnectorLifecycleState(detail.lifecycleState)}
            </AppText>
            <AppText style={styles.meta}>
              Health: {formatConnectorHealthStatus(detail.healthStatus)}
            </AppText>
            <AppText style={styles.meta}>
              Configuration: {detail.configurationValid ? 'Valid' : 'Needs attention'}
            </AppText>
            <AppText style={styles.meta}>
              Endpoint types: {detail.supportedEndpointTypes.join(', ') || 'Not declared'}
            </AppText>
          </View>

          {detail.configurationIssues.length > 0 ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.sectionTitle}>Validation</AppText>
              {detail.configurationIssues.map((issue) => (
                <AppText key={`${issue.field ?? 'global'}-${issue.message}`} style={styles.error}>
                  {issue.message}
                </AppText>
              ))}
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <AppText style={styles.sectionTitle}>Capabilities</AppText>
            {detail.capabilityDisplay.map((item) => (
              <View key={item.key} style={styles.capabilityRow}>
                <AppText style={styles.capabilityLabel}>
                  {item.label}: {item.supported ? 'Supported' : 'Not supported'}
                </AppText>
                <AppText style={styles.meta}>{item.description}</AppText>
              </View>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <AppText style={styles.sectionTitle}>Configuration</AppText>
            <View style={styles.toggleRow}>
              <SecondaryButton
                label={detail.settings.enabled ? 'Enabled' : 'Disabled'}
                onPress={() =>
                  canEdit &&
                  setDetail({
                    ...detail,
                    settings: { ...detail.settings, enabled: !detail.settings.enabled },
                  })
                }
                style={detail.settings.enabled ? styles.chipActive : undefined}
                disabled={!canEdit}
              />
              <SecondaryButton
                label={detail.settings.diagnosticsEnabled ? 'Diagnostics on' : 'Diagnostics off'}
                onPress={() =>
                  canEdit &&
                  setDetail({
                    ...detail,
                    settings: {
                      ...detail.settings,
                      diagnosticsEnabled: !detail.settings.diagnosticsEnabled,
                    },
                  })
                }
                style={detail.settings.diagnosticsEnabled ? styles.chipActive : undefined}
                disabled={!canEdit}
              />
            </View>
            <AppText style={styles.label}>Default timeout (ms)</AppText>
            <TextInput
              value={String(detail.settings.defaultTimeoutMs)}
              editable={canEdit}
              keyboardType="numeric"
              onChangeText={(value) =>
                setDetail({
                  ...detail,
                  settings: {
                    ...detail.settings,
                    defaultTimeoutMs: Number(value) || 0,
                  },
                })
              }
              style={styles.input}
              accessibilityLabel="Connector default timeout"
            />
            <AppText style={styles.label}>Max concurrent executions (placeholder)</AppText>
            <TextInput
              value={String(detail.settings.maxConcurrentExecutions)}
              editable={canEdit}
              keyboardType="numeric"
              onChangeText={(value) =>
                setDetail({
                  ...detail,
                  settings: {
                    ...detail.settings,
                    maxConcurrentExecutions: Number(value) || 1,
                  },
                })
              }
              style={styles.input}
              accessibilityLabel="Maximum concurrent executions placeholder"
            />
            <AppText style={styles.label}>Authentication placeholder</AppText>
            <TextInput
              value={detail.settings.authenticationMechanismPlaceholder ?? ''}
              editable={canEdit}
              onChangeText={(value) =>
                setDetail({
                  ...detail,
                  settings: {
                    ...detail.settings,
                    authenticationMechanismPlaceholder: value,
                  },
                })
              }
              style={styles.input}
              accessibilityLabel="Authentication mechanism placeholder"
              placeholder="Future authentication provider"
              placeholderTextColor={colorRoles.emptyStateDescription}
            />
            {canEdit ? (
              <PrimaryButton
                label={saving ? 'Saving…' : 'Save configuration'}
                onPress={() => void handleSave()}
                disabled={saving}
              />
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <AppText style={styles.sectionTitle}>Future Endpoints</AppText>
            <AppText style={styles.meta}>
              Endpoint management is not yet available. Sources will eventually assign connectors to
              specific endpoints.
            </AppText>
          </View>
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
  capabilityRow: { gap: spacing.xs },
  capabilityLabel: { ...textRoles.body },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
});
