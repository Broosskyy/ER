export type EntityAliasStoreErrorCode =
  | 'database_unavailable'
  | 'persistence_failed'
  | 'conflict'
  | 'invalid_input'
  | 'unauthorized'
  | 'not_found';

export class EntityAliasStoreError extends Error {
  readonly code: EntityAliasStoreErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: { code: EntityAliasStoreErrorCode; retryable?: boolean; cause?: unknown } = {
      code: 'persistence_failed',
    },
  ) {
    super(message);
    this.name = 'EntityAliasStoreError';
    this.code = options.code;
    this.retryable = options.retryable ?? options.code === 'database_unavailable';
    this.cause = options.cause;
  }
}
