import { PIPELINE_TEST_RAW_EVENTS } from '../data/raw-demo-events';
import type { RawEvent } from '../types/raw-event';

import type { EventSourceAdapter } from './types';

export class ManualImportAdapter implements EventSourceAdapter {
  getSourceName(): string {
    return 'manual';
  }

  validateSourceConfiguration(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  loadEvents(): RawEvent[] {
    return PIPELINE_TEST_RAW_EVENTS.filter(
      (event) => event.source === 'manual' || event.rawId === 'confirmed-dup-void',
    );
  }
}
