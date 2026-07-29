import type { Clock } from '@/core/clock/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export const systemClock = new SystemClock();
