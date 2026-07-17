import { DEMO_SOURCE_RAW_EVENTS } from '../data/raw-demo-events';
import type { RawEvent } from '../types/raw-event';

import type { EventSourceAdapter } from './types';

export class DemoSourceAdapter implements EventSourceAdapter {
  getSourceName(): string {
    return 'demo';
  }

  validateSourceConfiguration(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  loadEvents(): RawEvent[] {
    return DEMO_SOURCE_RAW_EVENTS;
  }
}
