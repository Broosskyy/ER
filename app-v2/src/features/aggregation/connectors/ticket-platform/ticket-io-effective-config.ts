import type { TicketPlatformSourceConfig } from './types';

/** Production Ticket.io shops ship without maxDetailPages; detail fetch must not stay disabled. */
export const TICKET_IO_DEFAULT_LIMITS = {
  maxEventsPerRun: 50,
  requestsPerMinute: 15,
  maxDetailPages: 15,
} as const;

export function withTicketIoEffectiveLimits(
  config: TicketPlatformSourceConfig,
): TicketPlatformSourceConfig {
  if (config.platform !== 'ticket_io') {
    return config;
  }

  const limits = config.limits ?? {};
  if (Number(limits.maxDetailPages ?? 0) > 0) {
    return config;
  }

  return {
    ...config,
    limits: {
      ...TICKET_IO_DEFAULT_LIMITS,
      ...limits,
      maxDetailPages: TICKET_IO_DEFAULT_LIMITS.maxDetailPages,
    },
  };
}
