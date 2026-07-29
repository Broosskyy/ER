export const SOURCE_CONNECTOR_REGISTRY_VERSION = '1.0.0';

export interface SourceConnectorVersionInfo {
  connectorVersion: string;
  schemaVersion: string;
  supportedApiVersions: string[];
  minimumRegistryVersion: string;
}

export function createSourceConnectorVersion(
  overrides: Partial<SourceConnectorVersionInfo> & Pick<SourceConnectorVersionInfo, 'connectorVersion'>,
): SourceConnectorVersionInfo {
  return {
    schemaVersion: '1.0.0',
    supportedApiVersions: ['1'],
    minimumRegistryVersion: SOURCE_CONNECTOR_REGISTRY_VERSION,
    ...overrides,
  };
}

export function isRegistryVersionCompatible(
  connector: SourceConnectorVersionInfo,
  registryVersion = SOURCE_CONNECTOR_REGISTRY_VERSION,
): boolean {
  return compareSemver(connector.minimumRegistryVersion, registryVersion) <= 0;
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}
