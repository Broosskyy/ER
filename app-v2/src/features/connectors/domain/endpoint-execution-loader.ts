import type { SourceRecord } from '@/data/types/records';
import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';

export interface LoadedExecutableEndpoint {
  endpoint: AcquisitionEndpoint;
  source: SourceRecord;
}

export interface EndpointExecutionLoader {
  loadByEndpointId(
    endpointId: string,
    sourceIdHint?: string,
  ): Promise<LoadedExecutableEndpoint | null>;
}

export class SourceConfigEndpointExecutionLoader implements EndpointExecutionLoader {
  constructor(
    private readonly sourceReader: {
      getById(id: string): Promise<SourceRecord | null>;
      getAll(): Promise<SourceRecord[]>;
    },
  ) {}

  async loadByEndpointId(
    endpointId: string,
    sourceIdHint?: string,
  ): Promise<LoadedExecutableEndpoint | null> {
    const trimmedId = endpointId.trim();
    if (!trimmedId) {
      return null;
    }

    if (sourceIdHint?.trim()) {
      const source = await this.sourceReader.getById(sourceIdHint.trim());
      const match = source?.sourceConfig?.endpoints?.find((entry) => entry.id === trimmedId);
      if (source && match) {
        return { endpoint: match, source };
      }
    }

    const sources = await this.sourceReader.getAll();
    for (const source of sources) {
      const match = source.sourceConfig?.endpoints?.find((entry) => entry.id === trimmedId);
      if (match) {
        return { endpoint: match, source };
      }
    }

    return null;
  }
}
