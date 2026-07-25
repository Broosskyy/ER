import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SurfaceCard } from '@/components/cards/SurfaceCard';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { layout } from '@/design/layout';
import { radii } from '@/design/radii';
import { shadows } from '@/design/shadows';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useResponsiveLayout } from '@/platform/responsive';
import {
  createEmptyEndpointPreviewDraft,
  createEndpointPreviewId,
  ENDPOINT_PREVIEW_HTTP_METHODS,
  ENDPOINT_PREVIEW_SAMPLE_DATA,
  type EndpointPreviewHttpMethod,
  type EndpointPreviewItem,
} from '@/features/sources/admin/endpoint-preview-data';

type SectionStatus = 'loading' | 'error' | 'ready';

type FormMode = { type: 'add' } | { type: 'edit'; endpointId: string };

const MOBILE_PREVIEW_VISIBLE_COUNT = 2;

const webBreakAllText = (Platform.OS === 'web'
  ? { wordBreak: 'break-all', overflowWrap: 'anywhere' }
  : {}) as TextStyle;

const webBreakWordText = (Platform.OS === 'web'
  ? { wordBreak: 'break-word', overflowWrap: 'anywhere' }
  : {}) as TextStyle;

const webModalFormScrollStyle = (Platform.OS === 'web'
  ? { maxHeight: '55vh' }
  : {}) as ViewStyle;

export interface SourceEndpointsSectionProps {
  canEdit: boolean;
  connectorOptions: Array<{ connectorKey: string; displayName: string }>;
}

type EndpointFormDraft = {
  name: string;
  url: string;
  httpMethod: EndpointPreviewHttpMethod;
  connectorKey: string;
  enabled: boolean;
  priority: string;
  description: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function draftFromEndpoint(endpoint: EndpointPreviewItem): EndpointFormDraft {
  return {
    name: endpoint.name,
    url: endpoint.url,
    httpMethod: endpoint.httpMethod,
    connectorKey: endpoint.connectorKey,
    enabled: endpoint.enabled,
    priority: String(endpoint.priority),
    description: endpoint.description ?? '',
  };
}

function formatConnectorLabel(
  connectorKey: string,
  connectorOptions: SourceEndpointsSectionProps['connectorOptions'],
): string {
  const match = connectorOptions.find((entry) => entry.connectorKey === connectorKey);
  return match ? `${match.displayName} (${connectorKey})` : connectorKey;
}

function EndpointStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <View
      style={[styles.statusBadge, enabled ? styles.statusBadgeActive : styles.statusBadgeInactive]}
      accessibilityRole="text"
      accessibilityLabel={enabled ? 'Aktiv' : 'Inaktiv'}
    >
      <AppText style={enabled ? styles.statusBadgeTextActive : styles.statusBadgeText}>
        {enabled ? 'Aktiv' : 'Inaktiv'}
      </AppText>
    </View>
  );
}

function EndpointMetaChip({
  label,
  value,
  fullRow = false,
}: {
  label: string;
  value: string;
  fullRow?: boolean;
}) {
  return (
    <View
      style={[styles.metaChip, fullRow && styles.metaChipInFullRow]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <AppText style={styles.metaChipLabel}>{label}</AppText>
      <AppText style={{ ...styles.metaChipValue, ...webBreakWordText }} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

function EndpointMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow} accessibilityRole="text">
      <AppText style={styles.metaLabel}>{label}</AppText>
      <AppText style={{ ...styles.metaValue, ...webBreakAllText }} selectable numberOfLines={3}>
        {value}
      </AppText>
    </View>
  );
}

function EndpointDialog({
  visible,
  title,
  hint,
  children,
  actions,
  onClose,
  isDesktop,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  isDesktop: boolean;
}) {
  const backdropStyle = styles.modalBackdropSheet;
  const cardStyle = isDesktop
    ? [styles.modalSheet, styles.modalSheetDesktop]
    : styles.modalSheet;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[backdropStyle, !isDesktop && styles.modalBackdropSheetMobile]}>
        <View style={cardStyle} accessibilityViewIsModal>
          <View style={styles.modalSheetBody}>
            <AppText style={styles.modalTitle}>{title}</AppText>
            {hint ? <AppText style={styles.modalHint}>{hint}</AppText> : null}
            {children}
            <View style={styles.modalActions}>{actions}</View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EndpointFormFields({
  draft,
  canEdit,
  connectorOptions,
  onChange,
}: {
  draft: EndpointFormDraft;
  canEdit: boolean;
  connectorOptions: SourceEndpointsSectionProps['connectorOptions'];
  onChange: (patch: Partial<EndpointFormDraft>) => void;
}) {
  return (
    <View style={styles.formFields}>
      <AppText style={styles.fieldLabel}>Name</AppText>
      <TextInput
        style={styles.input}
        value={draft.name}
        editable={canEdit}
        onChangeText={(value) => onChange({ name: value })}
        placeholder="z. B. Events listing page"
        placeholderTextColor={colorRoles.emptyStateDescription}
        accessibilityLabel="Endpoint-Name"
      />

      <AppText style={styles.fieldLabel}>URL</AppText>
      <TextInput
        style={styles.input}
        value={draft.url}
        editable={canEdit}
        onChangeText={(value) => onChange({ url: value })}
        placeholder="https://…"
        placeholderTextColor={colorRoles.emptyStateDescription}
        autoCapitalize="none"
        keyboardType="url"
        accessibilityLabel="Endpoint-URL"
      />

      <AppText style={styles.fieldLabel}>HTTP-Methode</AppText>
      <View style={styles.chips}>
        {ENDPOINT_PREVIEW_HTTP_METHODS.map((method) => (
          <SecondaryButton
            key={method}
            label={method}
            onPress={() => canEdit && onChange({ httpMethod: method })}
            style={draft.httpMethod === method ? styles.chipActive : undefined}
            disabled={!canEdit}
            accessibilityLabel={`HTTP-Methode ${method}`}
          />
        ))}
      </View>

      <AppText style={styles.fieldLabel}>Connector</AppText>
      <View style={styles.chips}>
        {connectorOptions.length === 0 ? (
          <AppText style={styles.helperText}>Keine Connectors registriert (Vorschau: website).</AppText>
        ) : (
          connectorOptions.map((connector) => (
            <SecondaryButton
              key={connector.connectorKey}
              label={connector.displayName}
              onPress={() => canEdit && onChange({ connectorKey: connector.connectorKey })}
              style={draft.connectorKey === connector.connectorKey ? styles.chipActive : undefined}
              disabled={!canEdit}
              accessibilityLabel={`Connector ${connector.displayName}`}
            />
          ))
        )}
      </View>

      <AppText style={styles.fieldLabel}>Priorität (0–100)</AppText>
      <TextInput
        style={styles.input}
        value={draft.priority}
        editable={canEdit}
        onChangeText={(value) => onChange({ priority: value })}
        keyboardType="numeric"
        accessibilityLabel="Endpoint-Priorität"
      />

      <AppText style={styles.fieldLabel}>Status</AppText>
      <View style={styles.chips}>
        <SecondaryButton
          label="Aktiv"
          onPress={() => canEdit && onChange({ enabled: true })}
          style={draft.enabled ? styles.chipActive : undefined}
          disabled={!canEdit}
        />
        <SecondaryButton
          label="Inaktiv"
          onPress={() => canEdit && onChange({ enabled: false })}
          style={!draft.enabled ? styles.chipActive : undefined}
          disabled={!canEdit}
        />
      </View>

      <AppText style={styles.fieldLabel}>Beschreibung</AppText>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={draft.description}
        editable={canEdit}
        onChangeText={(value) => onChange({ description: value })}
        multiline
        placeholder="Optionale Notiz für Admins"
        placeholderTextColor={colorRoles.emptyStateDescription}
        accessibilityLabel="Endpoint-Beschreibung"
      />
    </View>
  );
}

function EndpointCard({
  endpoint,
  canEdit,
  connectorOptions,
  isDesktop,
  onEdit,
  onDelete,
}: {
  endpoint: EndpointPreviewItem;
  canEdit: boolean;
  connectorOptions: SourceEndpointsSectionProps['connectorOptions'];
  isDesktop: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const connectorLabel = formatConnectorLabel(endpoint.connectorKey, connectorOptions);

  if (!isDesktop) {
    return (
      <SurfaceCard style={styles.endpointCardCompact} testID={`endpoint-card-${endpoint.id}`}>
        <View style={styles.compactHeader}>
          <AppText
            style={styles.cardTitleCompact}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {endpoint.name}
          </AppText>
          <EndpointStatusBadge enabled={endpoint.enabled} />
        </View>

        {endpoint.description ? (
          <AppText style={styles.cardDescription} numberOfLines={3}>
            {endpoint.description}
          </AppText>
        ) : null}

        <View style={styles.urlBlock}>
          <AppText style={styles.metaLabel}>URL</AppText>
          <AppText style={{ ...styles.urlValue, ...webBreakAllText }} selectable>
            {endpoint.url}
          </AppText>
        </View>

        <View style={styles.metaChips}>
          <EndpointMetaChip label="HTTP" value={endpoint.httpMethod} />
          <EndpointMetaChip label="Priorität" value={String(endpoint.priority)} />
        </View>
        <EndpointMetaChip label="Connector" value={connectorLabel} fullRow />

        <View style={styles.compactActionRow}>
          <SecondaryButton
            label="Bearbeiten"
            onPress={onEdit}
            disabled={!canEdit}
            style={styles.compactEditAction}
            accessibilityLabel={`Endpoint ${endpoint.name} bearbeiten`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Endpoint ${endpoint.name} löschen`}
            onPress={onDelete}
            disabled={!canEdit}
            style={({ pressed }) => [
              styles.compactIconAction,
              pressed && canEdit && styles.compactIconActionPressed,
              !canEdit && styles.compactIconActionDisabled,
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={canEdit ? colors.live : colorRoles.emptyStateDescription}
            />
          </Pressable>
          <View
            style={styles.compactTestAction}
            accessibilityRole="text"
            accessibilityLabel="Test ausführen deaktiviert"
            accessibilityHint="Wird in einem späteren Sprint mit der Execution Engine verbunden."
          >
            <Ionicons name="flash-outline" size={16} color={colorRoles.emptyStateDescription} />
            <AppText style={styles.compactTestLabel}>Test</AppText>
          </View>
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard style={styles.endpointCard} testID={`endpoint-card-${endpoint.id}`}>
      <View style={[styles.cardHeader, isDesktop && styles.cardHeaderDesktop]}>
        <View style={styles.cardTitleBlock}>
          <AppText style={styles.cardTitle} accessibilityRole="header">
            {endpoint.name}
          </AppText>
          <EndpointStatusBadge enabled={endpoint.enabled} />
        </View>
        <View
          style={[styles.cardActions, styles.cardActionsDesktop]}
        >
          <SecondaryButton
            label="Bearbeiten"
            onPress={onEdit}
            disabled={!canEdit}
            accessibilityLabel={`Endpoint ${endpoint.name} bearbeiten`}
          />
          <SecondaryButton
            label="Löschen"
            onPress={onDelete}
            disabled={!canEdit}
            accessibilityLabel={`Endpoint ${endpoint.name} löschen`}
          />
          <SecondaryButton
            label="Test ausführen"
            onPress={() => undefined}
            disabled
            accessibilityLabel="Test ausführen"
            accessibilityHint="Wird in einem späteren Sprint mit der Execution Engine verbunden."
          />
        </View>
      </View>

      {endpoint.description ? (
        <AppText style={styles.cardDescription}>{endpoint.description}</AppText>
      ) : null}

      <View style={styles.metaGridDesktop}>
        <EndpointMetaRow label="URL" value={endpoint.url} />
        <EndpointMetaRow label="HTTP" value={endpoint.httpMethod} />
        <EndpointMetaRow label="Connector" value={connectorLabel} />
        <EndpointMetaRow label="Priorität" value={String(endpoint.priority)} />
      </View>
    </SurfaceCard>
  );
}

export function SourceEndpointsSection({ canEdit, connectorOptions }: SourceEndpointsSectionProps) {
  const { breakpoint } = useResponsiveLayout();
  const isDesktop = breakpoint === 'desktop';
  const isMobile = breakpoint === 'mobile';

  const [status, setStatus] = useState<SectionStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointPreviewItem[]>([]);
  const [showAllMobileEndpoints, setShowAllMobileEndpoints] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formDraft, setFormDraft] = useState<EndpointFormDraft>(
    draftFromEndpoint({
      ...createEmptyEndpointPreviewDraft(),
      id: 'draft',
      description: '',
    }),
  );
  const [deleteTarget, setDeleteTarget] = useState<EndpointPreviewItem | null>(null);

  const resolvedConnectorOptions = useMemo(() => {
    if (connectorOptions.length > 0) {
      return connectorOptions;
    }
    return [{ connectorKey: 'website', displayName: 'Website Connector' }];
  }, [connectorOptions]);

  const loadPreviewEndpoints = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      await delay(450);
      const simulateError =
        typeof globalThis !== 'undefined' &&
        Boolean(
          (globalThis as { __ENDPOINT_UI_SIMULATE_ERROR__?: boolean }).__ENDPOINT_UI_SIMULATE_ERROR__,
        );
      if (simulateError) {
        setLoadError('Endpoints konnten momentan nicht geladen werden. Bitte versuchen Sie es erneut.');
        setStatus('error');
        return;
      }
      setEndpoints(ENDPOINT_PREVIEW_SAMPLE_DATA.map((entry) => ({ ...entry })));
      setStatus('ready');
    } catch {
      setLoadError('Endpoints konnten momentan nicht geladen werden. Bitte versuchen Sie es erneut.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadPreviewEndpoints();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadPreviewEndpoints]);

  const openAddForm = () => {
    setDeleteTarget(null);
    const empty = createEmptyEndpointPreviewDraft();
    setFormDraft({
      name: empty.name,
      url: empty.url,
      httpMethod: empty.httpMethod,
      connectorKey: resolvedConnectorOptions[0]?.connectorKey ?? empty.connectorKey,
      enabled: empty.enabled,
      priority: String(empty.priority),
      description: empty.description ?? '',
    });
    setFormMode({ type: 'add' });
  };

  const openEditForm = (endpoint: EndpointPreviewItem) => {
    setDeleteTarget(null);
    setFormDraft(draftFromEndpoint(endpoint));
    setFormMode({ type: 'edit', endpointId: endpoint.id });
  };

  const openDeleteDialog = (endpoint: EndpointPreviewItem) => {
    setFormMode(null);
    setDeleteTarget(endpoint);
  };

  const closeForm = () => {
    setFormMode(null);
  };

  const saveForm = () => {
    const priority = Math.min(100, Math.max(0, Number(formDraft.priority) || 0));
    const payload: EndpointPreviewItem = {
      id: formMode?.type === 'edit' ? formMode.endpointId : createEndpointPreviewId(),
      name: formDraft.name.trim() || 'Unbenannter Endpoint',
      url: formDraft.url.trim() || 'https://example.com',
      httpMethod: formDraft.httpMethod,
      connectorKey: formDraft.connectorKey,
      enabled: formDraft.enabled,
      priority,
      description: formDraft.description.trim() || undefined,
    };

    if (formMode?.type === 'edit') {
      setEndpoints((current) =>
        current.map((entry) => (entry.id === payload.id ? payload : entry)),
      );
    } else {
      setEndpoints((current) => [...current, payload]);
    }
    setFormMode(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    setEndpoints((current) => current.filter((entry) => entry.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const sectionHeaderStyle: ViewStyle[] = [styles.sectionHeader];
  if (isDesktop) {
    sectionHeaderStyle.push(styles.sectionHeaderDesktop);
  }

  const visibleEndpoints = useMemo(() => {
    if (!isMobile || showAllMobileEndpoints || endpoints.length <= MOBILE_PREVIEW_VISIBLE_COUNT) {
      return endpoints;
    }
    return endpoints.slice(0, MOBILE_PREVIEW_VISIBLE_COUNT);
  }, [endpoints, isMobile, showAllMobileEndpoints]);

  const hiddenMobileEndpointCount = Math.max(0, endpoints.length - MOBILE_PREVIEW_VISIBLE_COUNT);

  return (
    <View style={styles.section} accessibilityLabel="Endpoints-Verwaltung">
      <View style={sectionHeaderStyle}>
        <View style={styles.sectionHeading}>
          <AppText style={styles.sectionTitle} accessibilityRole="header">
            Endpoints
          </AppText>
          <AppText style={styles.sectionDescription}>
            Adressierbare Acquisition-Ziele für diese Source. Jeder Endpoint wird über einen
            Connector abgerufen — Ausführung folgt in einem späteren Sprint.
          </AppText>
          <AppText style={styles.previewNotice}>
            Vorschau-Daten — keine Persistenz, keine API-Aufrufe.
          </AppText>
        </View>
        {canEdit && status === 'ready' ? (
          <PrimaryButton
            label="Endpoint hinzufügen"
            onPress={openAddForm}
            style={isDesktop ? styles.headerActionDesktop : styles.headerActionMobile}
            accessibilityLabel="Endpoint hinzufügen"
          />
        ) : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.inlineState} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} size="small" />
          <AppText style={styles.inlineStateText}>Endpoints werden geladen…</AppText>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.inlineState} accessibilityLiveRegion="polite">
          <AppText style={styles.inlineErrorTitle}>Endpoints nicht verfügbar</AppText>
          <AppText style={styles.inlineStateText}>
            {loadError ?? 'Ein unerwarteter Fehler ist aufgetreten.'}
          </AppText>
          <SecondaryButton
            label="Erneut versuchen"
            onPress={() => void loadPreviewEndpoints()}
            style={styles.retryButton}
          />
        </View>
      ) : null}

      {status === 'ready' && endpoints.length === 0 ? (
        <View style={styles.emptyState}>
          <AppText style={styles.emptyTitle}>Noch keine Endpoints</AppText>
          <AppText style={styles.emptyDescription}>
            Endpoints definieren konkrete URLs oder Ziele, die ein Connector für diese Source
            abrufen soll — zum Beispiel eine Event-Übersichtsseite oder ein Feed.
          </AppText>
          {canEdit ? (
            <PrimaryButton
              label="Ersten Endpoint hinzufügen"
              onPress={openAddForm}
              style={styles.emptyAction}
            />
          ) : null}
        </View>
      ) : null}

      {status === 'ready' && endpoints.length > 0 ? (
        <View style={[styles.list, isDesktop && styles.listDesktop]}>
          {visibleEndpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              canEdit={canEdit}
              connectorOptions={resolvedConnectorOptions}
              isDesktop={isDesktop}
              onEdit={() => openEditForm(endpoint)}
              onDelete={() => openDeleteDialog(endpoint)}
            />
          ))}
        </View>
      ) : null}

      {status === 'ready' && isMobile && hiddenMobileEndpointCount > 0 ? (
        <SecondaryButton
          label={
            showAllMobileEndpoints
              ? 'Weniger Endpoints anzeigen'
              : `${hiddenMobileEndpointCount} weitere${hiddenMobileEndpointCount === 1 ? '' : 's'} Endpoint${hiddenMobileEndpointCount === 1 ? '' : 's'} anzeigen`
          }
          onPress={() => setShowAllMobileEndpoints((current) => !current)}
          style={styles.expandListAction}
          accessibilityLabel={
            showAllMobileEndpoints ? 'Endpoint-Liste einklappen' : 'Weitere Endpoints anzeigen'
          }
        />
      ) : null}

      {status === 'ready' && endpoints.length > 0 && !isMobile ? (
        <AppText style={styles.disabledActionNote}>
          „Test ausführen“ ist deaktiviert — Execution-Engine-Anbindung folgt in einem späteren Sprint.
        </AppText>
      ) : null}

      <EndpointDialog
        visible={formMode !== null}
        title={formMode?.type === 'edit' ? 'Endpoint bearbeiten' : 'Endpoint hinzufügen'}
        hint="Nur lokale Vorschau — Speichern ändert keine Server-Daten."
        onClose={closeForm}
        isDesktop={isDesktop}
        actions={
          <>
            <SecondaryButton
              label="Abbrechen"
              onPress={closeForm}
              style={!isDesktop ? styles.modalActionButton : undefined}
            />
            <PrimaryButton
              label="Speichern"
              onPress={saveForm}
              disabled={!canEdit}
              style={!isDesktop ? styles.modalActionButton : undefined}
            />
          </>
        }
      >
        <ScrollView
          style={[styles.modalFormScroll, webModalFormScrollStyle]}
          contentContainerStyle={styles.modalFormScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <EndpointFormFields
            draft={formDraft}
            canEdit={canEdit}
            connectorOptions={resolvedConnectorOptions}
            onChange={(patch) => setFormDraft((current) => ({ ...current, ...patch }))}
          />
        </ScrollView>
      </EndpointDialog>

      <EndpointDialog
        visible={deleteTarget !== null}
        title="Endpoint löschen?"
        hint={
          deleteTarget
            ? `„${deleteTarget.name}" wird nur aus der lokalen Vorschau entfernt.`
            : undefined
        }
        onClose={() => setDeleteTarget(null)}
        isDesktop={isDesktop}
        actions={
          <>
            <SecondaryButton
              label="Abbrechen"
              onPress={() => setDeleteTarget(null)}
              style={!isDesktop ? styles.modalActionButton : undefined}
            />
            <PrimaryButton
              label="Löschen"
              onPress={confirmDelete}
              disabled={!canEdit}
              style={!isDesktop ? styles.modalActionButton : undefined}
            />
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    gap: spacing.md,
  },
  sectionHeaderDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...textRoles.sectionTitle,
  },
  sectionDescription: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
  previewNotice: {
    ...textRoles.metadata,
    color: colors.warning,
  },
  headerActionMobile: {
    alignSelf: 'stretch',
  },
  headerActionDesktop: {
    alignSelf: 'flex-start',
    minWidth: 200,
    marginLeft: spacing.lg,
  },
  inlineState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  inlineStateText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textAlign: 'center',
  },
  inlineErrorTitle: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: layout.minTouchTarget * 2,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  emptyTitle: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
  },
  emptyDescription: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.sm,
    minWidth: 220,
  },
  list: {
    gap: spacing.md,
  },
  listDesktop: {
    gap: spacing.lg,
  },
  endpointCard: {
    gap: spacing.sm,
  },
  endpointCardCompact: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitleCompact: {
    ...textRoles.sectionTitle,
    flex: 1,
    minWidth: 0,
  },
  urlBlock: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  urlValue: {
    ...textRoles.body,
    color: colors.textPrimary,
    flexShrink: 1,
    minWidth: 0,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    width: '100%',
  },
  metaChip: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 0,
    maxWidth: '100%',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  metaChipInFullRow: {
    flexBasis: '100%',
    width: '100%',
  },
  metaChipLabel: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  metaChipValue: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    flexShrink: 1,
    minWidth: 0,
  },
  compactActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  compactEditAction: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },
  compactIconAction: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
  },
  compactIconActionPressed: {
    borderColor: colors.live,
    backgroundColor: colors.surface,
  },
  compactIconActionDisabled: {
    opacity: 0.5,
  },
  compactTestAction: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    opacity: 0.55,
  },
  compactTestLabel: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    fontSize: 11,
  },
  expandListAction: {
    alignSelf: 'stretch',
  },
  cardHeader: {
    gap: spacing.sm,
  },
  cardHeaderDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  cardTitle: {
    ...textRoles.sectionTitle,
  },
  cardDescription: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  cardActionsDesktop: {
    justifyContent: 'flex-end',
    maxWidth: 460,
  },
  metaGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaRow: {
    gap: spacing.xs,
    minWidth: 140,
    flexGrow: 1,
    flexBasis: '45%',
  },
  metaLabel: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  metaValue: {
    ...textRoles.body,
    color: colors.textPrimary,
    flexShrink: 1,
    minWidth: 0,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadgeActive: {
    borderColor: colors.success,
    backgroundColor: colors.surfaceElevated,
  },
  statusBadgeInactive: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusBadgeText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  statusBadgeTextActive: {
    ...textRoles.metadata,
    color: colors.success,
  },
  disabledActionNote: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textAlign: 'center',
  },
  modalBackdropSheet: {
    flex: 1,
    backgroundColor: colorRoles.overlayScrim,
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1000,
      },
    }),
  },
  modalBackdropSheetMobile: {
    backgroundColor: 'rgba(11, 11, 15, 0.9)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '92%',
    width: '100%',
    overflow: 'hidden',
    ...shadows.elevated,
    ...Platform.select({
      web: {
        zIndex: 1001,
      },
    }),
  },
  modalSheetBody: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  modalSheetDesktop: {
    alignSelf: 'center',
    maxWidth: 560,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...textRoles.sectionTitle,
  },
  modalHint: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  modalFormScroll: {
    maxHeight: 360,
    backgroundColor: colors.surface,
  },
  modalFormScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalActionButton: {
    minWidth: 120,
  },
  formFields: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    minHeight: layout.minTouchTarget,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipActive: {
    borderColor: colors.primary,
  },
  helperText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
});
