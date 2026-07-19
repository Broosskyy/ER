import { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import { ApiJsonImportAdapter } from '@/features/import/adapters/api-json-adapter';
import { CsvImportAdapter } from '@/features/import/adapters/csv-adapter';
import { atomImportAdapter, rssImportAdapter } from '@/features/import/adapters/feed-adapter';
import { IcalImportAdapter } from '@/features/import/adapters/ical-adapter';
import { JsonLdImportAdapter } from '@/features/import/adapters/json-ld-adapter';

export function registerImportAdapters(registry: ImportAdapterRegistry): void {
  const adapters = [
    new JsonLdImportAdapter(),
    rssImportAdapter,
    atomImportAdapter,
    new IcalImportAdapter(),
    new CsvImportAdapter(),
    new ApiJsonImportAdapter(),
  ];

  for (const adapter of adapters) {
    if (!registry.has(adapter.adapterKey)) {
      registry.register(adapter);
    }
  }
}
