import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { getErrorMessage } from '@/core/errors/app-error';
import { connectorAdminService, sourceService, adminMultiSourceService } from '@/data/repositories/registry';
import type { SourceRecord } from '@/data/types/records';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canManageSources } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import type { SourceDetailMultiSourceContext } from '@/features/admin/services/admin-multi-source-service';
import { formatConnectorHealthStatus } from '@/features/connectors/admin/connector-labels';
import type { ConnectorDescriptor } from '@/features/connectors/registry/connector-registry';
import type { ConnectorSourceAssignmentView } from '@/features/connectors/services/connector-admin-service';
import {
  formatAcquisitionStrategyLabel,
  formatParserTypeLabel,
  formatPollingStrategyLabel,
  formatSourceStatus,
  formatSourceTypeLabel,
} from '@/features/sources/admin/source-labels';
import { SourceEndpointsSection } from '@/features/sources/admin/SourceEndpointsSection';
import { SOURCE_DEFAULT_TRUST_SCORE ,
  ACQUISITION_STRATEGIES,
  PARSER_TYPES,
  POLLING_STRATEGIES,
  SOURCE_TYPES,
} from '@/features/sources/domain/source-types';
import { validateSourceInput } from '@/features/sources/domain/source-validation';

function createEmptySource(id: string): SourceRecord {
  const now = new Date().toISOString();
  return {
    id,
    slug: '',
    displayName: '',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: SOURCE_DEFAULT_TRUST_SCORE,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    createdAt: now,
    updatedAt: now,
  };
}

type ConfirmAction = 'archive' | 'restore' | 'enable' | 'disable';

export default function AdminSourceEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAdminAuth();
  const isNew = id === 'new';
  const canEdit = canManageSources(role);
  const [draftSourceId] = useState(() => `src-${Date.now()}`);
  const [record, setRecord] = useState<SourceRecord | null>(
    isNew ? createEmptySource(draftSourceId) : null,
  );
  const [importJobCount, setImportJobCount] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [connectorAssignment, setConnectorAssignment] = useState<ConnectorSourceAssignmentView | null>(null);
  const [assignableConnectors, setAssignableConnectors] = useState<ConnectorDescriptor[]>([]);
  const [selectedConnectorKey, setSelectedConnectorKey] = useState<string | undefined>();
  const [endpointPlaceholder, setEndpointPlaceholder] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [multiSourceContext, setMultiSourceContext] = useState<SourceDetailMultiSourceContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isNew) {
        const loaded = await sourceService.getByIdForAdmin(role, id);
        if (!loaded) {
          setError('Source not found.');
          setRecord(null);
        } else {
          setRecord(loaded);
          setImportJobCount(await sourceService.countImportJobs(role, loaded.id));
          const [assignment, connectors] = await Promise.all([
            connectorAdminService.getSourceAssignment(role, loaded.id),
            connectorAdminService.listAssignableConnectors(role),
          ]);
          setConnectorAssignment(assignment);
          setAssignableConnectors(connectors);
          setSelectedConnectorKey(assignment.connectorKey);
          setEndpointPlaceholder(assignment.endpointPlaceholder ?? '');
          setMultiSourceContext(await adminMultiSourceService.loadSourceDetailContext(role ?? 'viewer', loaded.id));
        }
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const updateField = <K extends keyof SourceRecord>(key: K, value: SourceRecord[K]) => {
    setRecord((current) => (current ? { ...current, [key]: value } : current));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const validateDraft = (): boolean => {
    if (!record) {
      return false;
    }

    try {
      validateSourceInput({
        slug: record.slug || undefined,
        displayName: record.displayName,
        description: record.description,
        sourceType: record.sourceType,
        baseUrl: record.baseUrl,
        parserType: record.parserType,
        acquisitionStrategy: record.acquisitionStrategy,
        pollingStrategy: record.pollingStrategy,
        pollingIntervalMinutes: record.pollingIntervalMinutes,
        rateLimitPerHour: record.rateLimitPerHour,
        priority: record.priority,
        trustScore: record.trustScore,
        requiresAuthentication: record.requiresAuthentication,
        enabled: record.enabled,
        archived: record.archived,
        notes: record.notes,
        website: record.website,
        defaultTimezone: record.defaultTimezone,
        reviewRequired: record.reviewRequired,
      });
      setFieldErrors({});
      return true;
    } catch (cause) {
      const message = getErrorMessage(cause);
      if (message.includes('Display name')) {
        setFieldErrors({ displayName: message });
      } else if (message.includes('Slug')) {
        setFieldErrors({ slug: message });
      } else if (message.includes('Base URL')) {
        setFieldErrors({ baseUrl: message });
      } else if (message.includes('Priority')) {
        setFieldErrors({ priority: message });
      } else if (message.includes('Trust score')) {
        setFieldErrors({ trustScore: message });
      } else {
        setError(message);
      }
      return false;
    }
  };

  const saveConnectorAssignment = async () => {
    if (!record || !canEdit) {
      return;
    }
    setAssignmentSaving(true);
    setAssignmentSuccess(null);
    setError(null);
    try {
      const assignment = await connectorAdminService.assignConnectorToSource(
        role,
        record.id,
        selectedConnectorKey,
        endpointPlaceholder,
      );
      setConnectorAssignment(assignment);
      setRecord((current) =>
        current
          ? {
              ...current,
              sourceConfig: {
                ...(current.sourceConfig ?? {}),
                connector: selectedConnectorKey
                  ? {
                      connectorKey: selectedConnectorKey,
                      endpointPlaceholder: endpointPlaceholder.trim() || undefined,
                    }
                  : undefined,
              },
            }
          : current,
      );
      setAssignmentSuccess('Connector assignment saved.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleSave = async () => {
    if (!record || !canEdit || !validateDraft()) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const input = {
        id: record.id,
        slug: record.slug || undefined,
        displayName: record.displayName,
        description: record.description,
        sourceType: record.sourceType,
        baseUrl: record.baseUrl,
        parserType: record.parserType,
        acquisitionStrategy: record.acquisitionStrategy,
        pollingStrategy: record.pollingStrategy,
        pollingIntervalMinutes: record.pollingIntervalMinutes,
        rateLimitPerHour: record.rateLimitPerHour,
        priority: record.priority,
        trustScore: record.trustScore,
        requiresAuthentication: record.requiresAuthentication,
        enabled: record.enabled,
        archived: record.archived,
        notes: record.notes,
        website: record.website,
        defaultTimezone: record.defaultTimezone,
        reviewRequired: record.reviewRequired,
        sourceConfig: record.sourceConfig,
      };

      const saved = isNew
        ? await sourceService.create(role, input)
        : await sourceService.update(role, { ...input, id: record.id });
      setRecord(saved);
      setSuccess('Source saved successfully.');
      if (isNew) {
        router.replace(`/admin/sources/${saved.id}` as `/admin/events/${string}`);
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!record || !canEdit || !confirmAction) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let updated = record;
      if (confirmAction === 'archive') {
        updated = await sourceService.archive(role, record.id);
      } else if (confirmAction === 'restore') {
        updated = await sourceService.restore(role, record.id);
      } else if (confirmAction === 'enable') {
        updated = await sourceService.setEnabled(role, record.id, true);
      } else if (confirmAction === 'disable') {
        updated = await sourceService.setEnabled(role, record.id, false);
      }
      setRecord(updated);
      setSuccess(`Source ${confirmAction}${confirmAction.endsWith('e') ? 'd' : 'ed'} successfully.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  };

  if (loading) return <AdminLoadingState label="Loading source…" />;
  if (error && !record) return <AdminErrorState message={error} onRetry={load} />;
  if (!record) return <AdminErrorState message="Source not found." onRetry={load} />;

  const confirmLabels: Record<ConfirmAction, string> = {
    archive: 'Archive this source? It cannot be enabled while archived.',
    restore: 'Restore this source from the archive?',
    enable: 'Enable this source for future acquisition?',
    disable: 'Disable this source? Acquisition jobs will not run.',
  };

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText role="screenTitle" style={styles.title}>{isNew ? 'Create Source' : record.displayName}</AppText>
          </View>

          {error ? <AppText style={styles.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          {!isNew ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.sectionTitle}>Multi-Source Status</AppText>
              <AppText style={styles.meta}>
                References: {multiSourceContext?.sourceReferences.length ?? 0} · Provenance fields:{' '}
                {multiSourceContext?.provenanceCount ?? 0}
              </AppText>
              <AppText style={styles.meta}>
                Open conflicts: {multiSourceContext?.openConflicts.length ?? 0} · Duplicate decisions:{' '}
                {multiSourceContext?.duplicateDecisions.length ?? 0}
              </AppText>
              <AppText style={styles.meta}>
                Health: {multiSourceContext?.health.status ?? 'unknown'} ({multiSourceContext?.health.score ?? 0}) ·
                Quality: {multiSourceContext?.quality.tier ?? 'unknown'} ({multiSourceContext?.quality.qualityScore ?? 0})
              </AppText>
            </View>
          ) : null}

          {!isNew ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.sectionTitle}>Status</AppText>
              <AppText style={styles.meta}>
                {formatSourceStatus(record.enabled, record.archived)} · {importJobCount} import job(s)
              </AppText>
              <AppText style={styles.meta}>Slug: {record.slug}</AppText>
              <AppText style={styles.meta}>Created {new Date(record.createdAt).toLocaleString()}</AppText>
              <AppText style={styles.meta}>Updated {new Date(record.updatedAt).toLocaleString()}</AppText>
            </View>
          ) : null}

          <AppText role="sectionTitle" style={styles.label}>Display Name</AppText>
          <TextInput
            style={styles.input}
            value={record.displayName}
            editable={canEdit}
            onChangeText={(value) => updateField('displayName', value)}
            accessibilityLabel="Display name"
          />
          {fieldErrors.displayName ? (
            <AppText style={styles.fieldError}>{fieldErrors.displayName}</AppText>
          ) : null}

          <AppText role="sectionTitle" style={styles.label}>Slug</AppText>
          <TextInput
            style={styles.input}
            value={record.slug}
            editable={canEdit && !isNew}
            onChangeText={(value) => updateField('slug', value)}
            autoCapitalize="none"
            accessibilityLabel="Slug"
          />
          {fieldErrors.slug ? <AppText style={styles.fieldError}>{fieldErrors.slug}</AppText> : null}

          <AppText role="sectionTitle" style={styles.label}>Description</AppText>
          <TextInput
            style={[styles.input, styles.notes]}
            value={record.description ?? ''}
            editable={canEdit}
            multiline
            onChangeText={(value) => updateField('description', value)}
          />

          <AppText role="sectionTitle" style={styles.label}>Base URL</AppText>
          <TextInput
            style={styles.input}
            value={record.baseUrl ?? ''}
            editable={canEdit}
            autoCapitalize="none"
            onChangeText={(value) => updateField('baseUrl', value)}
          />
          {fieldErrors.baseUrl ? <AppText style={styles.fieldError}>{fieldErrors.baseUrl}</AppText> : null}

          <AppText role="sectionTitle" style={styles.label}>Source Type</AppText>
          <View style={styles.chips}>
            {SOURCE_TYPES.map((type) => (
              <SecondaryButton
                key={type}
                label={formatSourceTypeLabel(type)}
                onPress={() => canEdit && updateField('sourceType', type)}
                style={record.sourceType === type ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <AppText role="sectionTitle" style={styles.label}>Parser Type</AppText>
          <View style={styles.chips}>
            {PARSER_TYPES.map((type) => (
              <SecondaryButton
                key={type}
                label={formatParserTypeLabel(type)}
                onPress={() => canEdit && updateField('parserType', type)}
                style={record.parserType === type ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <AppText role="sectionTitle" style={styles.label}>Acquisition Strategy</AppText>
          <View style={styles.chips}>
            {ACQUISITION_STRATEGIES.map((strategy) => (
              <SecondaryButton
                key={strategy}
                label={formatAcquisitionStrategyLabel(strategy)}
                onPress={() => canEdit && updateField('acquisitionStrategy', strategy)}
                style={record.acquisitionStrategy === strategy ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <AppText role="sectionTitle" style={styles.label}>Polling Strategy</AppText>
          <View style={styles.chips}>
            {POLLING_STRATEGIES.map((strategy) => (
              <SecondaryButton
                key={strategy}
                label={formatPollingStrategyLabel(strategy)}
                onPress={() => canEdit && updateField('pollingStrategy', strategy)}
                style={record.pollingStrategy === strategy ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <AppText role="sectionTitle" style={styles.label}>Polling Interval (minutes)</AppText>
          <TextInput
            style={styles.input}
            value={record.pollingIntervalMinutes?.toString() ?? ''}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) =>
              updateField('pollingIntervalMinutes', value.trim() ? Number(value) : undefined)
            }
          />

          <AppText role="sectionTitle" style={styles.label}>Rate Limit (per hour)</AppText>
          <TextInput
            style={styles.input}
            value={record.rateLimitPerHour?.toString() ?? ''}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) =>
              updateField('rateLimitPerHour', value.trim() ? Number(value) : undefined)
            }
          />

          <AppText role="sectionTitle" style={styles.label}>Priority (0–100)</AppText>
          <TextInput
            style={styles.input}
            value={String(record.priority)}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) => updateField('priority', Number(value) || 0)}
          />
          {fieldErrors.priority ? <AppText style={styles.fieldError}>{fieldErrors.priority}</AppText> : null}

          <AppText role="sectionTitle" style={styles.label}>Trust Score (0–100)</AppText>
          <TextInput
            style={styles.input}
            value={String(record.trustScore)}
            editable={canEdit}
            keyboardType="numeric"
            onChangeText={(value) => updateField('trustScore', Number(value) || 0)}
          />
          {fieldErrors.trustScore ? (
            <AppText style={styles.fieldError}>{fieldErrors.trustScore}</AppText>
          ) : null}

          <AppText role="sectionTitle" style={styles.label}>Website</AppText>
          <TextInput
            style={styles.input}
            value={record.website ?? ''}
            editable={canEdit}
            autoCapitalize="none"
            onChangeText={(value) => updateField('website', value)}
          />

          <AppText role="sectionTitle" style={styles.label}>Notes</AppText>
          <TextInput
            style={[styles.input, styles.notes]}
            value={record.notes ?? ''}
            editable={canEdit}
            multiline
            onChangeText={(value) => updateField('notes', value)}
          />

          <View style={styles.toggleRow}>
            <SecondaryButton
              label={record.requiresAuthentication ? 'Auth required' : 'No auth required'}
              onPress={() =>
                canEdit && updateField('requiresAuthentication', !record.requiresAuthentication)
              }
              style={record.requiresAuthentication ? styles.chipActive : undefined}
            />
            <SecondaryButton
              label={record.enabled ? 'Enabled' : 'Disabled'}
              onPress={() => canEdit && !record.archived && updateField('enabled', !record.enabled)}
              style={record.enabled ? styles.chipActive : undefined}
              disabled={record.archived}
            />
            <SecondaryButton
              label={record.archived ? 'Archived' : 'Active record'}
              onPress={() => canEdit && updateField('archived', !record.archived)}
              style={record.archived ? styles.chipActive : undefined}
            />
          </View>

          {!isNew ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.sectionTitle}>Connector Assignment</AppText>
              <AppText style={styles.meta}>
                Source → Assigned Connector → Future Endpoint
              </AppText>
              <AppText style={styles.meta}>
                Framework configuration only. Execution is not yet available.
              </AppText>
              {assignmentSuccess ? (
                <AppText style={styles.success} accessibilityLiveRegion="polite">
                  {assignmentSuccess}
                </AppText>
              ) : null}
              {connectorAssignment ? (
                <AppText style={styles.meta}>
                  Health: {formatConnectorHealthStatus(connectorAssignment.healthStatus)}
                </AppText>
              ) : null}
              <View style={styles.toggleRow}>
                <SecondaryButton
                  label="No connector"
                  onPress={() => canEdit && setSelectedConnectorKey(undefined)}
                  style={!selectedConnectorKey ? styles.chipActive : undefined}
                  disabled={!canEdit}
                />
                {assignableConnectors.map((connector) => (
                  <SecondaryButton
                    key={connector.connectorKey}
                    label={connector.displayName}
                    onPress={() => canEdit && setSelectedConnectorKey(connector.connectorKey)}
                    style={
                      selectedConnectorKey === connector.connectorKey ? styles.chipActive : undefined
                    }
                    disabled={!canEdit}
                  />
                ))}
              </View>
              {assignableConnectors.length === 0 ? (
                <AppText style={styles.meta}>
                  No connectors are registered yet. Configure the framework under Admin → Connectors.
                </AppText>
              ) : null}
              {selectedConnectorKey ? (
                <SecondaryButton
                  label="View connector details"
                  onPress={() =>
                    router.push(
                      `/admin/connectors/${selectedConnectorKey}` as `/admin/events/${string}`,
                    )
                  }
                />
              ) : null}
              {canEdit ? (
                <SecondaryButton
                  label={assignmentSaving ? 'Saving assignment…' : 'Save connector assignment'}
                  onPress={() => void saveConnectorAssignment()}
                  disabled={assignmentSaving}
                />
              ) : null}
            </View>
          ) : null}

          {!isNew ? (
            <View style={styles.endpointsSection}>
              <SourceEndpointsSection
                canEdit={canEdit}
                connectorOptions={assignableConnectors.map((connector) => ({
                  connectorKey: connector.connectorKey,
                  displayName: connector.displayName,
                }))}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            {canEdit ? (
              <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
            ) : null}
            {canEdit && !isNew && !record.archived ? (
              <SecondaryButton
                label={record.enabled ? 'Disable' : 'Enable'}
                onPress={() => setConfirmAction(record.enabled ? 'disable' : 'enable')}
                disabled={saving}
              />
            ) : null}
            {canEdit && !isNew && !record.archived ? (
              <SecondaryButton label="Archive" onPress={() => setConfirmAction('archive')} disabled={saving} />
            ) : null}
            {canEdit && !isNew && record.archived ? (
              <SecondaryButton label="Restore" onPress={() => setConfirmAction('restore')} disabled={saving} />
            ) : null}
          </View>
        </ScrollView>

        <Modal visible={confirmAction !== null} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <AppText style={styles.sectionTitle}>Confirm</AppText>
              <AppText style={styles.meta}>
                {confirmAction ? confirmLabels[confirmAction] : ''}
              </AppText>
              <View style={styles.modalActions}>
                <SecondaryButton label="Cancel" onPress={() => setConfirmAction(null)} />
                <PrimaryButton label="Confirm" onPress={() => void runConfirmedAction()} />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { flex: 1 },
  label: { marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipActive: { borderColor: colors.primary },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  sectionTitle: { ...textRoles.sectionTitle },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  endpointsSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  error: { ...textRoles.body, color: colors.live },
  success: { ...textRoles.body, color: colors.primary },
  fieldError: { ...textRoles.metadata, color: colors.live },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
