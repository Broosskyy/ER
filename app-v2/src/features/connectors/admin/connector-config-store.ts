import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createDefaultConnectorSettings,
  DEFAULT_CONNECTOR_GLOBAL_SETTINGS,
  type ConnectorFrameworkSettings,
  type ConnectorGlobalFrameworkSettings,
} from '@/features/connectors/domain/connector-config';

const STORAGE_KEY = 'app.connectorFrameworkAdminConfig';

export interface ConnectorConfigPersistence {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const asyncStoragePersistence: ConnectorConfigPersistence = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export interface ConnectorAdminConfigSnapshot {
  global: ConnectorGlobalFrameworkSettings;
  perConnector: Record<string, ConnectorFrameworkSettings>;
}

function createDefaultSnapshot(): ConnectorAdminConfigSnapshot {
  return {
    global: { ...DEFAULT_CONNECTOR_GLOBAL_SETTINGS, featureFlags: {} },
    perConnector: {},
  };
}

export class ConnectorConfigStore {
  private snapshot: ConnectorAdminConfigSnapshot = createDefaultSnapshot();
  private loaded = false;

  constructor(private readonly persistence: ConnectorConfigPersistence = asyncStoragePersistence) {}

  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const raw = await this.persistence.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ConnectorAdminConfigSnapshot>;
        this.snapshot = {
          global: {
            ...DEFAULT_CONNECTOR_GLOBAL_SETTINGS,
            ...parsed.global,
            featureFlags: parsed.global?.featureFlags ?? {},
          },
          perConnector: parsed.perConnector ?? {},
        };
      }
    } catch {
      this.snapshot = createDefaultSnapshot();
    }

    this.loaded = true;
  }

  getSnapshot(): ConnectorAdminConfigSnapshot {
    return {
      global: {
        ...this.snapshot.global,
        featureFlags: { ...this.snapshot.global.featureFlags },
      },
      perConnector: Object.fromEntries(
        Object.entries(this.snapshot.perConnector).map(([key, value]) => [
          key,
          { ...value, featureFlags: { ...value.featureFlags } },
        ]),
      ),
    };
  }

  getGlobalSettings(): ConnectorGlobalFrameworkSettings {
    return {
      ...this.snapshot.global,
      featureFlags: { ...this.snapshot.global.featureFlags },
    };
  }

  getConnectorSettings(connectorKey: string): ConnectorFrameworkSettings {
    const existing = this.snapshot.perConnector[connectorKey];
    if (!existing) {
      return createDefaultConnectorSettings();
    }
    return {
      ...existing,
      featureFlags: { ...existing.featureFlags },
    };
  }

  async saveGlobalSettings(settings: ConnectorGlobalFrameworkSettings): Promise<void> {
    await this.ensureLoaded();
    this.snapshot.global = {
      ...settings,
      featureFlags: { ...settings.featureFlags },
    };
    await this.persist();
  }

  async saveConnectorSettings(
    connectorKey: string,
    settings: ConnectorFrameworkSettings,
  ): Promise<void> {
    await this.ensureLoaded();
    this.snapshot.perConnector[connectorKey] = {
      ...settings,
      featureFlags: { ...settings.featureFlags },
    };
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.persistence.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
  }

  /** Test helper — reset in-memory state. */
  resetForTests(): void {
    this.snapshot = createDefaultSnapshot();
    this.loaded = true;
  }
}

export const connectorConfigStore = new ConnectorConfigStore();
