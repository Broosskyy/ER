import { AppError } from '@/core/errors/app-error';
import type { SourceRecord } from '@/data/types/records';
import type { ConnectorDescriptor } from '@/features/connectors/registry/connector-registry';
import type { ConnectorFrameworkService } from '@/features/connectors/services/connector-framework-service';
import type { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import {
  canManageConnectors,
  canViewConnectors,
} from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import type { ConnectorConfigStore } from '@/features/connectors/admin/connector-config-store';
import {
  evaluateConnectorConfiguration,
  resolveConnectorHealthStatus,
  resolveConnectorLifecycleState,
  summarizeCapabilities,
} from '@/features/connectors/admin/connector-health';
import {
  validateConnectorFrameworkSettings,
  validateConnectorGlobalSettings,
} from '@/features/connectors/admin/connector-config-validation';
import { buildConnectorCapabilityDisplay } from '@/features/connectors/admin/connector-labels';
import type {
  ConnectorFrameworkSettings,
  ConnectorGlobalFrameworkSettings,
  ConnectorHealthStatus,
} from '@/features/connectors/domain/connector-config';
import type { ConnectorLifecycleState } from '@/features/connectors/domain/connector-lifecycle';
import type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import { ConnectorRegistryError } from '@/features/connectors/errors/connector-errors';

function assertCanView(role: AdminRole | null): void {
  if (!canViewConnectors(role)) {
    throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
  }
}

function assertCanManage(role: AdminRole | null): void {
  if (!canManageConnectors(role)) {
    throw new AppError('You do not have permission to manage connectors.', { code: 'UNAUTHORIZED' });
  }
}

export interface ConnectorAdminListItem {
  connectorKey: string;
  displayName: string;
  version?: string;
  lifecycleState: ConnectorLifecycleState;
  healthStatus: ConnectorHealthStatus;
  capabilitySummary: string;
  supportedEndpointTypes: string[];
  configurationStatus: 'valid' | 'invalid' | 'disabled';
  enabled: boolean;
}

export interface ConnectorAdminDetail {
  connectorKey: string;
  displayName: string;
  version?: string;
  lifecycleState: ConnectorLifecycleState;
  healthStatus: ConnectorHealthStatus;
  capabilities: ConnectorCapabilities;
  capabilityDisplay: ReturnType<typeof buildConnectorCapabilityDisplay>;
  supportedEndpointTypes: string[];
  settings: ConnectorFrameworkSettings;
  configurationIssues: Array<{ field?: string; message: string }>;
  configurationValid: boolean;
}

export interface ConnectorFrameworkDiagnosticsView {
  frameworkReady: boolean;
  executionAvailable: boolean;
  registeredCount: number;
  connectorKeys: string[];
  globalSettings: ConnectorGlobalFrameworkSettings;
  registryIssues: Array<{ connectorKey: string; message: string }>;
  configurationIssues: Array<{ connectorKey: string; message: string }>;
}

export interface ConnectorSourceAssignmentView {
  sourceId: string;
  sourceDisplayName: string;
  connectorKey?: string;
  connectorDisplayName?: string;
  healthStatus: ConnectorHealthStatus;
  endpointPlaceholder?: string;
  futureEndpointNote: string;
}

export class ConnectorAdminService {
  constructor(
    private readonly frameworkService: ConnectorFrameworkService,
    private readonly registry: ConnectorRegistry,
    private readonly configStore: ConnectorConfigStore,
    private readonly sourceReader?: {
      getByIdForAdmin(role: AdminRole | null, id: string): Promise<SourceRecord | null>;
    },
    private readonly sourceWriter?: {
      updateConnectorAssignment(
        role: AdminRole | null,
        sourceId: string,
        connectorKey: string | undefined,
        endpointPlaceholder?: string,
      ): Promise<SourceRecord>;
    },
  ) {}

  async listForAdmin(role: AdminRole | null): Promise<ConnectorAdminListItem[]> {
    assertCanView(role);
    await this.configStore.ensureLoaded();
    const global = this.configStore.getGlobalSettings();

    return this.frameworkService.listConnectors().map((descriptor) =>
      this.toListItem(descriptor, global.enabled),
    );
  }

  async getGlobalSettings(role: AdminRole | null): Promise<ConnectorGlobalFrameworkSettings> {
    assertCanView(role);
    await this.configStore.ensureLoaded();
    return this.configStore.getGlobalSettings();
  }

  async updateGlobalSettings(
    role: AdminRole | null,
    settings: ConnectorGlobalFrameworkSettings,
  ): Promise<ConnectorGlobalFrameworkSettings> {
    assertCanManage(role);
    const validation = validateConnectorGlobalSettings(settings);
    if (!validation.valid) {
      throw new AppError(validation.issues.map((issue) => issue.message).join(' '), {
        code: 'VALIDATION',
      });
    }
    await this.configStore.saveGlobalSettings(settings);
    return this.configStore.getGlobalSettings();
  }

  async getConnectorDetail(role: AdminRole | null, connectorKey: string): Promise<ConnectorAdminDetail> {
    assertCanView(role);
    await this.configStore.ensureLoaded();
    const registration = this.registry.getRegistration(connectorKey);
    const global = this.configStore.getGlobalSettings();
    const settings = this.configStore.getConnectorSettings(connectorKey);
    const evaluation = evaluateConnectorConfiguration(registration, settings);

    return {
      connectorKey: registration.connectorKey,
      displayName: registration.displayName,
      version: registration.version,
      lifecycleState: resolveConnectorLifecycleState(
        registration,
        settings,
        evaluation.valid,
      ),
      healthStatus: resolveConnectorHealthStatus({
        registration,
        settings,
        globalEnabled: global.enabled,
        hasValidConfiguration: evaluation.valid,
      }),
      capabilities: registration.capabilities,
      capabilityDisplay: buildConnectorCapabilityDisplay(registration.capabilities),
      supportedEndpointTypes: registration.supportedEndpointTypes ?? [],
      settings,
      configurationIssues: evaluation.issues,
      configurationValid: evaluation.valid,
    };
  }

  async updateConnectorSettings(
    role: AdminRole | null,
    connectorKey: string,
    settings: ConnectorFrameworkSettings,
  ): Promise<ConnectorAdminDetail> {
    assertCanManage(role);
    this.registry.getRegistration(connectorKey);
    const validation = validateConnectorFrameworkSettings(settings);
    if (!validation.valid) {
      throw new AppError(validation.issues.map((issue) => issue.message).join(' '), {
        code: 'VALIDATION',
      });
    }
    await this.configStore.saveConnectorSettings(connectorKey, settings);
    return this.getConnectorDetail(role, connectorKey);
  }

  async getDiagnostics(role: AdminRole | null): Promise<ConnectorFrameworkDiagnosticsView> {
    assertCanView(role);
    await this.configStore.ensureLoaded();
    const diagnostics = this.frameworkService.getDiagnostics();
    const global = this.configStore.getGlobalSettings();
    const registryIssues: ConnectorFrameworkDiagnosticsView['registryIssues'] = [];
    const configurationIssues: ConnectorFrameworkDiagnosticsView['configurationIssues'] = [];

    for (const key of diagnostics.connectorKeys) {
      try {
        const registration = this.registry.getRegistration(key);
        const settings = this.configStore.getConnectorSettings(key);
        const evaluation = evaluateConnectorConfiguration(registration, settings);
        if (!evaluation.valid) {
          for (const issue of evaluation.issues) {
            configurationIssues.push({
              connectorKey: key,
              message: issue.message,
            });
          }
        }
      } catch (error) {
        registryIssues.push({
          connectorKey: key,
          message: error instanceof Error ? error.message : 'Registry integrity issue.',
        });
      }
    }

    const globalValidation = validateConnectorGlobalSettings(global);
    if (!globalValidation.valid) {
      for (const issue of globalValidation.issues) {
        configurationIssues.push({
          connectorKey: '__global__',
          message: issue.message,
        });
      }
    }

    return {
      frameworkReady: true,
      executionAvailable: true,
      registeredCount: diagnostics.registeredCount,
      connectorKeys: diagnostics.connectorKeys,
      globalSettings: global,
      registryIssues,
      configurationIssues,
    };
  }

  async getSourceAssignment(
    role: AdminRole | null,
    sourceId: string,
  ): Promise<ConnectorSourceAssignmentView> {
    assertCanView(role);
    if (!this.sourceReader) {
      throw new AppError('Source integration is not available.', { code: 'UNKNOWN' });
    }

    const source = await this.sourceReader.getByIdForAdmin(role, sourceId);
    if (!source) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }

    const connectorKey = source.sourceConfig?.connector?.connectorKey;
    let connectorDisplayName: string | undefined;
    let healthStatus: ConnectorHealthStatus = connectorKey ? 'unknown' : 'configuration_required';

    if (connectorKey) {
      try {
        const detail = await this.getConnectorDetail(role, connectorKey);
        connectorDisplayName = detail.displayName;
        healthStatus = detail.healthStatus;
      } catch (error) {
        healthStatus =
          error instanceof ConnectorRegistryError ? 'unsupported' : 'unknown';
      }
    }

    return {
      sourceId: source.id,
      sourceDisplayName: source.displayName,
      connectorKey,
      connectorDisplayName,
      healthStatus,
      endpointPlaceholder: source.sourceConfig?.connector?.endpointPlaceholder,
      futureEndpointNote:
        'Endpoint management is not yet available. One source may eventually own multiple endpoints.',
    };
  }

  async assignConnectorToSource(
    role: AdminRole | null,
    sourceId: string,
    connectorKey: string | undefined,
    endpointPlaceholder?: string,
  ): Promise<ConnectorSourceAssignmentView> {
    assertCanManage(role);
    if (!this.sourceWriter) {
      throw new AppError('Source integration is not available.', { code: 'UNKNOWN' });
    }

    if (connectorKey) {
      this.registry.getRegistration(connectorKey);
    }

    await this.sourceWriter.updateConnectorAssignment(
      role,
      sourceId,
      connectorKey,
      endpointPlaceholder,
    );

    return this.getSourceAssignment(role, sourceId);
  }

  async listAssignableConnectors(role: AdminRole | null): Promise<ConnectorDescriptor[]> {
    assertCanView(role);
    return this.frameworkService.listConnectors();
  }

  private toListItem(descriptor: ConnectorDescriptor, globalEnabled: boolean): ConnectorAdminListItem {
    const registration = this.registry.getRegistration(descriptor.connectorKey);
    const settings = this.configStore.getConnectorSettings(descriptor.connectorKey);
    const evaluation = evaluateConnectorConfiguration(registration, settings);

    return {
      connectorKey: descriptor.connectorKey,
      displayName: descriptor.displayName,
      version: descriptor.version,
      lifecycleState: resolveConnectorLifecycleState(
        registration,
        settings,
        evaluation.valid,
      ),
      healthStatus: resolveConnectorHealthStatus({
        registration,
        settings,
        globalEnabled,
        hasValidConfiguration: evaluation.valid,
      }),
      capabilitySummary: summarizeCapabilities(descriptor.capabilities),
      supportedEndpointTypes: descriptor.supportedEndpointTypes,
      configurationStatus: !settings.enabled
        ? 'disabled'
        : evaluation.valid
          ? 'valid'
          : 'invalid',
      enabled: settings.enabled && globalEnabled,
    };
  }
}
