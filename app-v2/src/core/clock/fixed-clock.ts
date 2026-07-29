import type { Clock } from '@/core/clock/clock';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}

  now(): Date {
    return new Date(this.fixed.getTime());
  }
}
