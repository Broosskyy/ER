import type { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import type { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import type { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import type { DiscoveryHttpAdapter } from '@/features/discovery/api/http/discovery-http-adapter';

let discoveryEngineRef: DiscoveryEngine | undefined;
let discoveryApiServiceRef: DiscoveryApiService | undefined;
let discoveryQueryPlatformRef: DiscoveryQueryPlatform | undefined;
let discoveryHttpAdapterRef: DiscoveryHttpAdapter | undefined;

export function bindDiscoveryServices(
  engine: DiscoveryEngine,
  apiService: DiscoveryApiService,
  queryPlatform?: DiscoveryQueryPlatform,
  httpAdapter?: DiscoveryHttpAdapter,
): void {
  discoveryEngineRef = engine;
  discoveryApiServiceRef = apiService;
  if (queryPlatform) {
    discoveryQueryPlatformRef = queryPlatform;
  }
  if (httpAdapter) {
    discoveryHttpAdapterRef = httpAdapter;
  }
}

export function getDiscoveryEngine(): DiscoveryEngine {
  if (!discoveryEngineRef) {
    throw new Error('Discovery engine is not initialized.');
  }
  return discoveryEngineRef;
}

export function getDiscoveryApiService(): DiscoveryApiService {
  if (!discoveryApiServiceRef) {
    throw new Error('Discovery API service is not initialized.');
  }
  return discoveryApiServiceRef;
}

export function getDiscoveryQueryPlatform(): DiscoveryQueryPlatform {
  if (!discoveryQueryPlatformRef) {
    throw new Error('Discovery query platform is not initialized.');
  }
  return discoveryQueryPlatformRef;
}

export function getDiscoveryHttpAdapter(): DiscoveryHttpAdapter {
  if (!discoveryHttpAdapterRef) {
    throw new Error('Discovery HTTP adapter is not initialized.');
  }
  return discoveryHttpAdapterRef;
}
