/**
 * Phase 4.8.2 — hard no-write enforcement for production shadow runs.
 */
export class ShadowWriteBlockedError extends Error {
  constructor(
    public readonly operation: string,
    public readonly table: string,
  ) {
    super(`Shadow write blocked: ${operation} on ${table}`);
    this.name = 'ShadowWriteBlockedError';
  }
}

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

export type ShadowWriteAttempt = {
  operation: string;
  table: string;
  at: string;
};

let writeAttempts: ShadowWriteAttempt[] = [];

export function resetShadowWriteAttempts(): void {
  writeAttempts = [];
}

export function recordShadowWriteAttempt(operation: string, table: string): never {
  writeAttempts.push({ operation, table, at: new Date().toISOString() });
  throw new ShadowWriteBlockedError(operation, table);
}

export function getShadowWriteAttempts(): ShadowWriteAttempt[] {
  return [...writeAttempts];
}

export function createShadowNoWriteQueryBuilder(table: string): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      const method = String(prop);
      if (WRITE_METHODS.has(method)) {
        return () => recordShadowWriteAttempt(method, table);
      }
      if (method === 'then') return undefined;
      return (..._args: unknown[]) => createShadowNoWriteQueryBuilder(table);
    },
  };
  return new Proxy({}, handler);
}

export function wrapClientForShadowReadOnly<T extends { from: (table: string) => unknown }>(
  client: T,
): T {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const realBuilder = target.from(table);
          if (!realBuilder || typeof realBuilder !== 'object') {
            return createShadowNoWriteQueryBuilder(table);
          }
          return new Proxy(realBuilder as object, {
            get(builderTarget, builderProp) {
              if (WRITE_METHODS.has(String(builderProp))) {
                return () => recordShadowWriteAttempt(String(builderProp), table);
              }
              const value = Reflect.get(builderTarget, builderProp);
              if (typeof value === 'function') {
                return value.bind(builderTarget);
              }
              return value;
            },
          });
        };
      }
      return Reflect.get(target, prop);
    },
  }) as T;
}

export function assertShadowNoWrite(context: {
  productionMutationsInThisRun: number;
  allowReadOnlyClient?: boolean;
}): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (context.productionMutationsInThisRun > 0) {
    violations.push(`productionMutationsInThisRun=${context.productionMutationsInThisRun}`);
  }
  for (const attempt of writeAttempts) {
    violations.push(`${attempt.operation}(${attempt.table}) at ${attempt.at}`);
  }
  return { ok: violations.length === 0, violations };
}

export function deliberateWriteAttemptShouldFail(): boolean {
  resetShadowWriteAttempts();
  try {
    const builder = createShadowNoWriteQueryBuilder('events') as { insert: (row: unknown) => void };
    builder.insert({ id: 'shadow-test' });
    return false;
  } catch (error) {
    return error instanceof ShadowWriteBlockedError;
  } finally {
    resetShadowWriteAttempts();
  }
}
