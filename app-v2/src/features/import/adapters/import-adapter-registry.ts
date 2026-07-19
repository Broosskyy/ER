import { ImportAdapterError } from '@/features/import/errors/import-errors';
import type { ImportSourceAdapter } from './types';

export class ImportAdapterRegistry {
  private readonly adapters = new Map<string, ImportSourceAdapter>();

  register(adapter: ImportSourceAdapter): void {
    if (!adapter.adapterKey.trim()) {
      throw new ImportAdapterError(
        'Adapter key must not be empty.',
        'IMPORT_ADAPTER_INVALID',
      );
    }
    if (this.adapters.has(adapter.adapterKey)) {
      throw new ImportAdapterError(
        `Adapter with key "${adapter.adapterKey}" is already registered.`,
        'IMPORT_ADAPTER_DUPLICATE',
      );
    }
    this.adapters.set(adapter.adapterKey, adapter);
  }

  get(adapterKey: string): ImportSourceAdapter {
    const adapter = this.adapters.get(adapterKey);
    if (!adapter) {
      throw new ImportAdapterError(
        `No import adapter registered for key "${adapterKey}".`,
        'IMPORT_ADAPTER_NOT_FOUND',
      );
    }
    return adapter;
  }

  has(adapterKey: string): boolean {
    return this.adapters.has(adapterKey);
  }

  listKeys(): string[] {
    return [...this.adapters.keys()];
  }
}

export const importAdapterRegistry = new ImportAdapterRegistry();
