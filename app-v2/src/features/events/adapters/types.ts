import type { RawEvent } from '../types/raw-event';

export interface EventSourceAdapter {
  getSourceName(): string;
  validateSourceConfiguration(): { valid: boolean; errors: string[] };
  loadEvents(): RawEvent[];
}

export function validateAdapterConfiguration(
  adapter: EventSourceAdapter,
): { valid: boolean; errors: string[] } {
  return adapter.validateSourceConfiguration();
}
